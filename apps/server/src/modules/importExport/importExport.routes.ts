import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  latestByCreatedAt,
  toCoverageStatus,
  toRunSummaryMetrics,
  toUniqueDefectKeys
} from "../reports/reportMetrics.service.js";
import { buildMilestoneSummary } from "../reports/milestoneSummary.service.js";
import {
  buildCaseActivitySummaryReport,
  caseActivitySummaryQuerySchema
} from "../reports/caseActivitySummary.service.js";
import {
  buildCasePropertyDistributionReport,
  buildCaseStatusTopsReport
} from "../reports/casePropertyReports.service.js";
import {
  buildDefectSummaryReportForProject,
  defectSummaryQuerySchema
} from "../reports/defectSummary.service.js";
import {
  buildResultsCaseComparisonReport,
  buildResultsPropertyDistributionReport,
  resultsCaseComparisonQuerySchema,
  resultsPropertyDistributionQuerySchema
} from "../reports/resultReports.service.js";
import {
  buildRefsComparisonReportForProject,
  buildRefsCoverageReportForProject,
  buildRefsDefectSummaryReportForProject,
  refsComparisonQuerySchema
} from "../reports/refsReports.service.js";
import {
  buildProjectExecutionSummaryForProject,
  buildUserWorkloadSummaryForProject
} from "../reports/projectSummaryReports.service.js";
import { PrismaRunsRepository } from "../runs/runs.prisma.repository.js";
import { runIdParamSchema } from "../runs/runs.schema.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import {
  parseAttachmentManifestJson,
  serializeAttachmentManifest
} from "../../domain/attachmentImportExport.js";
import {
  buildProjectAttachmentManifest,
  importAttachmentManifest
} from "../attachments/attachmentImportExport.service.js";
import {
  applyCaseCsvColumnMapping,
  buildCaseCsvImportProfile,
  extractCsvHeaders,
  suggestCaseCsvColumnMapping,
  validateCaseCsvColumnMapping
} from "../../domain/caseCsvMapping.js";
import {
  deleteStagedCsv,
  readStagedCsv,
  shouldUseAsyncImport,
  stageCaseCsvImportMeta,
  takeCaseCsvImportMeta,
  writeStagedCsv
} from "./importExportAsync.js";
import {
  CASE_CSV_REFS_COLUMN,
  caseRefsCsvAliases,
  caseRefsFromCsvCell,
  formatCaseRefsForCsv
} from "../../domain/caseRefs.js";
import { formatDurationSeconds, sumDurationSeconds } from "../../domain/timeTracking.js";
import { statusIdForCanonical } from "../testrail/testrail.mappers.js";

type CsvRow = Record<string, string>;
type ImportIssue = { row: number; field?: string; code: string; message: string };
type ScalarCustomValue = string | number | boolean | string[] | null;
type CaseImportFormat = "csv" | "json" | "xml";
type CustomFieldDefinition = {
  systemName: string;
  fieldType: string;
  options: Prisma.JsonValue | null;
  isRequired: boolean;
};

const columnMappingSchema = z.record(z.string(), z.string());

const caseImportSchema = z.object({
  csv: z.string().min(1),
  dryRun: z.boolean().optional().default(true),
  atomic: z.boolean().optional().default(true),
  sectionId: z.coerce.bigint().optional(),
  columnMapping: columnMappingSchema.optional()
});

const structuredCaseImportSchema = z.object({
  content: z.string().min(1),
  dryRun: z.boolean().optional().default(true),
  atomic: z.boolean().optional().default(true),
  sectionId: z.coerce.bigint().optional()
});

const suggestMappingSchema = z.object({
  headers: z.array(z.string().min(1)).min(1).optional(),
  csv: z.string().min(1).optional()
});

export const reportExportSchema = z.object({
  reportType: z
    .enum([
      "run_summary",
      "milestone_summary",
      "plan_summary",
      "results_explorer",
      "traceability",
      "coverage_gap",
      "defect_coverage",
      "defect_summary",
      "case_activity_summary",
      "cases_property_distribution",
      "status_tops",
      "results_case_comparison",
      "results_property_distribution",
      "refs_coverage",
      "refs_comparison",
      "refs_defect_summary",
      "project_summary",
      "users_workload_summary"
    ])
    .default("results_explorer"),
  format: z.enum(["csv"]).default("csv"),
  runId: z.coerce.bigint().optional(),
  runIdA: z.coerce.bigint().optional(),
  runIdB: z.coerce.bigint().optional(),
  milestoneId: z.coerce.bigint().optional(),
  planId: z.coerce.bigint().optional(),
  caseId: z.coerce.bigint().optional(),
  testId: z.coerce.bigint().optional(),
  status: z.enum(["passed", "failed", "blocked", "retest", "untested"]).optional(),
  source: z.enum(["manual", "automation", "api"]).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  q: z.string().trim().min(1).optional(),
  runLifecycleStatus: z.enum(["open", "closed"]).optional(),
  planLifecycleStatus: z.enum(["open", "closed"]).optional(),
  milestoneLifecycle: z.enum(["open", "upcoming", "completed"]).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  actorUserId: z.coerce.bigint().optional(),
  category: z.enum(["created", "updated", "deleted", "other", "all"]).optional(),
  field: z.string().trim().min(1).optional(),
  maxRows: z.coerce.number().int().min(1).max(50000).default(10000)
});

const exportJobIdParamSchema = z.object({
  jobId: z.coerce.bigint()
});

const importJobIdParamSchema = z.object({
  jobId: z.coerce.bigint()
});

const caseExportAsyncSchema = z.object({
  format: z.enum(["csv", "json", "xml"]).default("csv")
});

const runResultsExportAsyncSchema = z.object({
  runId: z.coerce.bigint()
});

function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    const next = input[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);

  const [headerRaw, ...body] = rows.filter((r) => r.some((cell) => cell.trim().length > 0));
  if (!headerRaw) return [];
  const headers = headerRaw.map((h) => h.trim());
  return body.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()]))
  );
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
}

function normalizeJsonScalar(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => normalizeJsonScalar(item)).filter(Boolean).join("|");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function jsonCaseToCsvRow(value: unknown): CsvRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("VALIDATION_ERROR", "JSON case rows must be objects", 400);
  }
  const source = value as Record<string, unknown>;
  const customValues =
    source.customValues && typeof source.customValues === "object" && !Array.isArray(source.customValues)
      ? (source.customValues as Record<string, unknown>)
      : source.custom_values && typeof source.custom_values === "object" && !Array.isArray(source.custom_values)
        ? (source.custom_values as Record<string, unknown>)
        : {};
  const steps = Array.isArray(source.steps)
    ? source.steps
        .map((step) => {
          if (typeof step === "string") return step;
          if (!step || typeof step !== "object") return "";
          const stepRow = step as Record<string, unknown>;
          const content = normalizeJsonScalar(stepRow.content ?? stepRow.step);
          const expected = normalizeJsonScalar(stepRow.expectedResult ?? stepRow.expected_result ?? stepRow.expected);
          return expected ? `${content}=>${expected}` : content;
        })
        .filter(Boolean)
        .join("|")
    : normalizeJsonScalar(source.steps);
  return {
    section_id: normalizeJsonScalar(source.section_id ?? source.sectionId),
    title: normalizeJsonScalar(source.title ?? source.name),
    preconditions: normalizeJsonScalar(source.preconditions),
    priority: normalizeJsonScalar(source.priority),
    type: normalizeJsonScalar(source.type ?? source.caseType ?? source.case_type),
    [CASE_CSV_REFS_COLUMN]: Array.isArray(source.refs)
      ? source.refs.map((item) => normalizeJsonScalar(item)).filter(Boolean).join(", ")
      : normalizeJsonScalar(source.refs ?? source.references),
    labels: Array.isArray(source.labels)
      ? source.labels.map((item) => normalizeJsonScalar(item)).filter(Boolean).join("|")
      : normalizeJsonScalar(source.labels),
    automation_key: normalizeJsonScalar(source.automation_key ?? source.automationKey),
    external_id: normalizeJsonScalar(source.external_id ?? source.externalId),
    steps,
    ...Object.fromEntries(
      Object.entries(customValues).map(([key, customValue]) => [customColumnName(key.replace(/^custom_/, "")), normalizeJsonScalar(customValue)])
    ),
    ...Object.fromEntries(
      Object.entries(source)
        .filter(([key]) => key.startsWith("custom_"))
        .map(([key, customValue]) => [key, normalizeJsonScalar(customValue)])
    )
  };
}

function parseCaseJsonImport(content: string): CsvRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError("VALIDATION_ERROR", "JSON import must be valid JSON with a cases array or an array of case objects", 400);
  }
  const cases = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { cases?: unknown }).cases)
      ? (parsed as { cases: unknown[] }).cases
      : null;
  if (!cases) {
    throw new AppError("VALIDATION_ERROR", "JSON import expects { \"cases\": [...] } or an array of case objects", 400);
  }
  return cases.map(jsonCaseToCsvRow);
}

function xmlEscape(value: unknown) {
  return normalizeJsonScalar(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlUnescape(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .trim();
}

function xmlTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? xmlUnescape(match[1] ?? "") : "";
}

function xmlAttr(block: string, attr: string) {
  const match = block.match(new RegExp(`${attr}="([^"]*)"`, "i"));
  return match ? xmlUnescape(match[1] ?? "") : "";
}

function parseCaseXmlImport(content: string): CsvRow[] {
  const caseBlocks = [...content.matchAll(/<case\b[\s\S]*?<\/case>/gi)];
  if (caseBlocks.length === 0) {
    throw new AppError("VALIDATION_ERROR", "XML import expects <cases><case>...</case></cases>", 400);
  }
  return caseBlocks.map((match) => {
    const block = match[0];
    const labels = [...block.matchAll(/<label>([\s\S]*?)<\/label>/gi)].map((item) => xmlUnescape(item[1] ?? ""));
    const steps = [...block.matchAll(/<step\b[\s\S]*?<\/step>/gi)]
      .map((stepMatch) => {
        const stepBlock = stepMatch[0];
        const contentText = xmlTag(stepBlock, "content") || xmlTag(stepBlock, "step");
        const expected = xmlTag(stepBlock, "expected_result") || xmlTag(stepBlock, "expectedResult") || xmlTag(stepBlock, "expected");
        return expected ? `${contentText}=>${expected}` : contentText;
      })
      .filter(Boolean)
      .join("|");
    const customFields = [...block.matchAll(/<custom\b([^>]*)>([\s\S]*?)<\/custom>/gi)].map((item) => {
      const name = xmlAttr(item[1] ?? "", "name");
      return [customColumnName(name.replace(/^custom_/, "")), xmlUnescape(item[2] ?? "")] as const;
    });
    return {
      section_id: xmlAttr(block, "section_id") || xmlAttr(block, "sectionId") || xmlTag(block, "section_id"),
      title: xmlTag(block, "title") || xmlTag(block, "name"),
      preconditions: xmlTag(block, "preconditions"),
      priority: xmlTag(block, "priority"),
      type: xmlTag(block, "type") || xmlTag(block, "case_type"),
      [CASE_CSV_REFS_COLUMN]: xmlTag(block, CASE_CSV_REFS_COLUMN) || xmlTag(block, "references"),
      labels: labels.length > 0 ? labels.join("|") : xmlTag(block, "labels"),
      automation_key: xmlTag(block, "automation_key") || xmlTag(block, "automationKey"),
      external_id: xmlTag(block, "external_id") || xmlTag(block, "externalId"),
      steps: steps || xmlTag(block, "steps"),
      ...Object.fromEntries(customFields)
    };
  });
}

function normalizeReportFilters(input: z.infer<typeof reportExportSchema>) {
  return {
    reportType: input.reportType,
    format: input.format,
    ...(input.runId ? { runId: input.runId.toString() } : {}),
    ...(input.runIdA ? { runIdA: input.runIdA.toString() } : {}),
    ...(input.runIdB ? { runIdB: input.runIdB.toString() } : {}),
    ...(input.milestoneId ? { milestoneId: input.milestoneId.toString() } : {}),
    ...(input.planId ? { planId: input.planId.toString() } : {}),
    ...(input.caseId ? { caseId: input.caseId.toString() } : {}),
    ...(input.testId ? { testId: input.testId.toString() } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.createdFrom ? { createdFrom: input.createdFrom } : {}),
    ...(input.createdTo ? { createdTo: input.createdTo } : {}),
    ...(input.q ? { q: input.q } : {}),
    ...(input.runLifecycleStatus ? { runLifecycleStatus: input.runLifecycleStatus } : {}),
    ...(input.planLifecycleStatus ? { planLifecycleStatus: input.planLifecycleStatus } : {}),
    ...(input.milestoneLifecycle ? { milestoneLifecycle: input.milestoneLifecycle } : {}),
    ...(input.days != null ? { days: input.days } : {}),
    ...(input.actorUserId ? { actorUserId: input.actorUserId.toString() } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.field ? { field: input.field } : {}),
    maxRows: input.maxRows
  };
}

function parseReportFilters(value: Prisma.JsonValue | null | undefined) {
  const raw = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  return reportExportSchema.parse(raw);
}

type CaseExportRecord = {
  id: string;
  section_id: string;
  title: string;
  preconditions: string | null;
  mission: string | null;
  goals: string | null;
  ai_input: string | null;
  ai_expected_output: string | null;
  priority: string | null;
  type: string | null;
  refs: string;
  labels: string[];
  automation_key: string | null;
  external_id: string | null;
  customValues: Record<string, unknown>;
  steps: Array<{ content: string; expected_result: string | null }>;
};

type RunResultExportRecord = {
  result_id: string;
  test_id: string;
  case_id: string;
  refs: string;
  status: string;
  status_id: number;
  comment: string | null;
  elapsed: string | null;
  version: string | null;
  source: string;
  defects: string[];
  customValues: Record<string, unknown>;
  created_at: string;
  created_on: number;
};

function caseExportRecordToCsvRow(record: CaseExportRecord, customFieldNames: string[]) {
  return {
    id: record.id,
    section_id: record.section_id,
    title: record.title,
    preconditions: record.preconditions,
    mission: record.mission,
    goals: record.goals,
    ai_input: record.ai_input,
    ai_expected_output: record.ai_expected_output,
    priority: record.priority,
    type: record.type,
    refs: record.refs,
    labels: record.labels.join("|"),
    automation_key: record.automation_key,
    external_id: record.external_id,
    ...Object.fromEntries(customFieldNames.map((fieldName) => [customColumnName(fieldName), record.customValues[fieldName] ?? ""])),
    steps: record.steps.map((step) => `${step.content}${step.expected_result ? `=>${step.expected_result}` : ""}`).join("|")
  };
}

function testRailCollection<T>(key: string, rows: T[]) {
  return {
    offset: 0,
    limit: rows.length,
    size: rows.length,
    _links: { next: null, prev: null },
    [key]: rows
  };
}

function caseExportRecordToTestRailRow(record: CaseExportRecord, customFieldNames: string[]) {
  return {
    id: Number(record.id),
    section_id: Number(record.section_id),
    title: record.title,
    refs: record.refs || null,
    custom_preconds: record.preconditions ?? null,
    priority: record.priority ?? null,
    type: record.type ?? null,
    labels: record.labels,
    automation_key: record.automation_key,
    external_id: record.external_id,
    custom_steps_separated: record.steps.map((step) => ({
      content: step.content,
      expected: step.expected_result ?? ""
    })),
    ...Object.fromEntries(customFieldNames.map((fieldName) => [customColumnName(fieldName), record.customValues[fieldName] ?? ""]))
  };
}

function casesToTestRailExport(cases: CaseExportRecord[], customFieldNames: string[]) {
  return JSON.stringify(
    testRailCollection("cases", cases.map((row) => caseExportRecordToTestRailRow(row, customFieldNames))),
    null,
    2
  );
}

function casesToJsonExport(projectId: bigint, cases: CaseExportRecord[]) {
  return JSON.stringify(
    {
      format: "testrail-clone.cases",
      version: 1,
      project_id: projectId.toString(),
      cases
    },
    null,
    2
  );
}

function runResultRecordToCsvRow(record: RunResultExportRecord, customFieldNames: string[]) {
  return {
    result_id: record.result_id,
    test_id: record.test_id,
    case_id: record.case_id,
    refs: record.refs,
    status: record.status,
    comment: record.comment,
    elapsed: record.elapsed,
    version: record.version,
    source: record.source,
    defects: record.defects.join("|"),
    ...Object.fromEntries(customFieldNames.map((fieldName) => [customColumnName(fieldName), record.customValues[fieldName] ?? ""])),
    created_at: record.created_at
  };
}

function runResultRecordToTestRailRow(record: RunResultExportRecord, customFieldNames: string[]) {
  return {
    id: Number(record.result_id),
    test_id: Number(record.test_id),
    case_id: Number(record.case_id),
    status_id: record.status_id,
    status: record.status,
    comment: record.comment ?? null,
    elapsed: record.elapsed ?? null,
    version: record.version ?? null,
    defects: record.defects.length > 0 ? record.defects.join(", ") : null,
    created_on: record.created_on,
    refs: record.refs || null,
    source: record.source,
    ...Object.fromEntries(customFieldNames.map((fieldName) => [customColumnName(fieldName), record.customValues[fieldName] ?? ""]))
  };
}

function runResultsToTestRailExport(runId: bigint, records: RunResultExportRecord[], customFieldNames: string[]) {
  return JSON.stringify(
    {
      run_id: Number(runId),
      ...testRailCollection("results", records.map((row) => runResultRecordToTestRailRow(row, customFieldNames)))
    },
    null,
    2
  );
}

function casesToXmlExport(projectId: bigint, cases: CaseExportRecord[]) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<cases format="testrail-clone.cases" version="1" project_id="${xmlEscape(projectId.toString())}">`,
    ...cases.map((row) =>
      [
        `  <case id="${xmlEscape(row.id)}" section_id="${xmlEscape(row.section_id)}">`,
        `    <title>${xmlEscape(row.title)}</title>`,
        `    <preconditions>${xmlEscape(row.preconditions)}</preconditions>`,
        `    <priority>${xmlEscape(row.priority)}</priority>`,
        `    <type>${xmlEscape(row.type)}</type>`,
        `    <refs>${xmlEscape(row.refs)}</refs>`,
        "    <labels>",
        ...row.labels.map((label) => `      <label>${xmlEscape(label)}</label>`),
        "    </labels>",
        `    <automation_key>${xmlEscape(row.automation_key)}</automation_key>`,
        `    <external_id>${xmlEscape(row.external_id)}</external_id>`,
        "    <custom_values>",
        ...Object.entries(row.customValues).map(
          ([key, value]) => `      <custom name="${xmlEscape(key)}">${xmlEscape(value)}</custom>`
        ),
        "    </custom_values>",
        "    <steps>",
        ...row.steps.map((step) =>
          [
            "      <step>",
            `        <content>${xmlEscape(step.content)}</content>`,
            `        <expected_result>${xmlEscape(step.expected_result)}</expected_result>`,
            "      </step>"
          ].join("\n")
        ),
        "    </steps>",
        "  </case>"
      ].join("\n")
    ),
    "</cases>"
  ].join("\n");
}

function firstValue(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value && value.length > 0) return value;
  }
  return undefined;
}

function splitList(value?: string) {
  return value ? value.split(/[|;]/).map((item) => item.trim()).filter(Boolean) : [];
}

function customColumnName(systemName: string) {
  return `custom_${systemName}`;
}

function customValueFromJson(value: Prisma.JsonValue | null, systemName: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return (value as Record<string, unknown>)[systemName] ?? "";
}

function fieldOptions(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseCustomFieldValue(
  rawValue: string | undefined,
  field: CustomFieldDefinition,
  rowNumber: number,
  issues: ImportIssue[]
): ScalarCustomValue | undefined {
  const fieldName = customColumnName(field.systemName);
  if (rawValue == null || rawValue === "") {
    if (field.isRequired) {
      issues.push({ row: rowNumber, field: fieldName, code: "REQUIRED", message: `${fieldName} is required` });
    }
    return undefined;
  }
  if (field.fieldType === "number") {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      issues.push({ row: rowNumber, field: fieldName, code: "INVALID_NUMBER", message: `${fieldName} must be a number` });
      return undefined;
    }
    return value;
  }
  if (field.fieldType === "select") {
    const options = fieldOptions(field.options);
    if (!options.includes(rawValue)) {
      issues.push({
        row: rowNumber,
        field: fieldName,
        code: "INVALID_OPTION",
        message: `${fieldName} must be one of: ${options.join(", ")}`
      });
      return undefined;
    }
  }
  if (field.fieldType === "boolean") {
    const normalized = rawValue.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
    issues.push({ row: rowNumber, field: fieldName, code: "INVALID_BOOLEAN", message: `${fieldName} must be true or false` });
    return undefined;
  }
  return rawValue;
}

function extractCustomValues(row: CsvRow, fields: CustomFieldDefinition[], rowNumber: number, issues: ImportIssue[]) {
  const values: Record<string, ScalarCustomValue> = {};
  for (const field of fields) {
    const rawValue = firstValue(row, [customColumnName(field.systemName), field.systemName]);
    const parsed = parseCustomFieldValue(rawValue, field, rowNumber, issues);
    if (parsed !== undefined) values[field.systemName] = parsed;
  }
  return values;
}

async function resolveDefaultSection(prisma: PrismaClient, projectId: bigint) {
  const row = await prisma.section.findFirst({
    where: { suite: { projectId }, deletedAt: null },
    orderBy: { id: "asc" },
    select: { id: true }
  });
  return row?.id;
}

async function buildReportExport(prisma: PrismaClient, projectId: bigint, input: z.infer<typeof reportExportSchema>) {
  if (input.reportType === "run_summary") {
    const runs = await prisma.testRun.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(input.runLifecycleStatus ? { status: input.runLifecycleStatus } : {}),
        ...(input.q ? { name: { contains: input.q, mode: "insensitive" } } : {})
      },
      orderBy: { id: "asc" },
      take: input.maxRows,
      include: {
        instances: {
          where: { deletedAt: null },
          select: { status: true, estimateSnapshot: true, results: { select: { elapsed: true } } }
        }
      }
    });
    const rows = runs.map((run) => {
      const metrics = toRunSummaryMetrics(run.instances.map((item) => item.status));
      const estimatedSeconds = sumDurationSeconds(run.instances.map((item) => item.estimateSnapshot));
      const actualSeconds = sumDurationSeconds(run.instances.flatMap((item) => item.results.map((result) => result.elapsed)));
      const actualOverEstimateSeconds = actualSeconds - estimatedSeconds;
      return {
        run_id: run.id,
        name: run.name,
        status: run.status,
        total: metrics.total,
        passed: metrics.passed,
        failed: metrics.failed,
        progress: metrics.progress,
        estimated_seconds: estimatedSeconds,
        actual_seconds: actualSeconds,
        actual_over_estimate_seconds: actualOverEstimateSeconds,
        estimate: formatDurationSeconds(estimatedSeconds),
        actual: formatDurationSeconds(actualSeconds)
      };
    });
    return {
      fileName: `project-${projectId.toString()}-run-summary.csv`,
      csv: toCsv(
        [
          "run_id",
          "name",
          "status",
          "total",
          "passed",
          "failed",
          "progress",
          "estimated_seconds",
          "actual_seconds",
          "actual_over_estimate_seconds",
          "estimate",
          "actual"
        ],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "milestone_summary") {
    const { items } = await buildMilestoneSummary(projectId, { prisma });
    const filteredItems = items.filter((row) => {
      if (input.milestoneLifecycle && row.lifecycleStatus !== input.milestoneLifecycle) return false;
      if (input.q && !row.name.toLowerCase().includes(input.q.toLowerCase())) return false;
      return true;
    });
    const rows = filteredItems.slice(0, input.maxRows).map((row) => ({
      milestone_id: row.milestoneId,
      parent_milestone_id: row.parentMilestoneId ?? "",
      name: row.name,
      lifecycle_status: row.lifecycleStatus,
      is_completed: row.isCompleted,
      child_count: row.childCount,
      includes_sub_milestones: row.includesSubMilestones,
      run_count: row.runCount,
      open_run_count: row.openRunCount,
      direct_run_count: row.directRunCount,
      total: row.total,
      passed: row.passed,
      failed: row.failed,
      progress: row.progress,
      direct_total: row.directTotal,
      direct_progress: row.directProgress
    }));
    return {
      fileName: `project-${projectId.toString()}-milestone-summary.csv`,
      csv: toCsv(
        [
          "milestone_id",
          "parent_milestone_id",
          "name",
          "lifecycle_status",
          "is_completed",
          "child_count",
          "includes_sub_milestones",
          "run_count",
          "open_run_count",
          "direct_run_count",
          "total",
          "passed",
          "failed",
          "progress",
          "direct_total",
          "direct_progress"
        ],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "plan_summary") {
    const plans = await prisma.testPlan.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(input.planLifecycleStatus ? { status: input.planLifecycleStatus } : {}),
        ...(input.q ? { name: { contains: input.q, mode: "insensitive" } } : {})
      },
      orderBy: [{ status: "asc" }, { id: "desc" }],
      take: input.maxRows,
      include: {
        entries: {
          where: { deletedAt: null },
          include: {
            run: {
              include: { instances: { where: { deletedAt: null }, select: { status: true } } }
            }
          }
        },
        runs: {
          where: { deletedAt: null },
          include: { instances: { where: { deletedAt: null }, select: { status: true } } }
        }
      }
    });
    const rows = plans.map((plan) => {
      const runMap = new Map<string, (typeof plan.runs)[number]>();
      for (const run of plan.runs) runMap.set(run.id.toString(), run);
      for (const entry of plan.entries) {
        if (entry.run) runMap.set(entry.run.id.toString(), entry.run);
      }
      const runs = Array.from(runMap.values());
      const metrics = toRunSummaryMetrics(runs.flatMap((run) => run.instances.map((item) => item.status)));
      return {
        plan_id: plan.id,
        name: plan.name,
        status: plan.status,
        entry_count: plan.entries.length,
        run_count: runs.length,
        open_run_count: runs.filter((run) => run.status === "open").length,
        total: metrics.total,
        passed: metrics.passed,
        failed: metrics.failed,
        progress: metrics.progress
      };
    });
    return {
      fileName: `project-${projectId.toString()}-plan-summary.csv`,
      csv: toCsv(
        ["plan_id", "name", "status", "entry_count", "run_count", "open_run_count", "total", "passed", "failed", "progress"],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "results_explorer") {
    const customFields = await prisma.customField.findMany({
      where: { projectId, scope: "result", deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { systemName: true }
    });
    const customHeaders = customFields.map((field) => customColumnName(field.systemName));
    const where: Prisma.TestResultWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.testId ? { testInstanceId: input.testId } : {}),
      ...((input.createdFrom || input.createdTo)
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: new Date(input.createdFrom) } : {}),
              ...(input.createdTo ? { lte: new Date(input.createdTo) } : {})
            }
          }
        : {}),
      instance: {
        ...(input.runId ? { runId: input.runId } : {}),
        ...(input.caseId ? { caseId: input.caseId } : {}),
        run: { projectId, deletedAt: null },
        ...(input.q
          ? {
              OR: [
                { titleSnapshot: { contains: input.q, mode: "insensitive" } },
                ...(input.q.match(/^c\d+$/i) ? [{ caseId: BigInt(input.q.replace(/^c/i, "")) }] : [])
              ]
            }
          : {})
      }
    };
    const rows = await prisma.testResult.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.maxRows,
      include: {
        instance: { include: { run: true, testCase: { select: { refs: true } } } },
        defectLinks: { where: { deletedAt: null } }
      }
    });
    return {
      fileName: `project-${projectId.toString()}-results-explorer.csv`,
      csv: toCsv(
        [
          "result_id",
          "run_id",
          "run_name",
          "test_id",
          "case_id",
          "title",
          CASE_CSV_REFS_COLUMN,
          "status",
          "source",
          "comment",
          "defects",
          ...customHeaders,
          "created_at"
        ],
        rows.map((row) => ({
          result_id: row.id,
          run_id: row.instance.runId,
          run_name: row.instance.run.name,
          test_id: row.testInstanceId,
          case_id: row.instance.caseId,
          title: row.instance.titleSnapshot,
          refs: formatCaseRefsForCsv(row.instance.testCase.refs),
          status: row.status,
          source: row.source,
          comment: row.comment,
          defects: [...row.defects, ...row.defectLinks.map((link) => link.defectKey)].join("|"),
          ...Object.fromEntries(
            customFields.map((field) => [customColumnName(field.systemName), customValueFromJson(row.customValues, field.systemName)])
          ),
          created_at: row.createdAt.toISOString()
        }))
      ),
      totalRows: rows.length
    };
  }

    const requirements = await prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      take: input.maxRows,
      include: {
        caseLinks: {
          where: { testCase: { deletedAt: null, archivedAt: null } },
          include: {
            testCase: {
            select: {
              id: true,
              title: true,
              instances: {
                where: { run: { projectId, deletedAt: null } },
                include: {
                  run: { select: { id: true, name: true } },
                  results: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: { defectLinks: { where: { deletedAt: null }, select: { defectKey: true } } }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (input.reportType === "traceability") {
    const rows = requirements.flatMap((reqRow) =>
      reqRow.caseLinks.map((link) => {
        const latest = latestByCreatedAt(
          link.testCase.instances
            .map((inst) => ({ runId: inst.run.id, runName: inst.run.name, testId: inst.id, result: inst.results[0] }))
            .filter((row) => row.result)
            .map((row) => ({ ...row, createdAt: row.result!.createdAt }))
        );
        return {
          requirement_id: reqRow.id,
          requirement_key: reqRow.key,
          requirement_title: reqRow.title,
          case_id: link.testCase.id,
          case_title: link.testCase.title,
          run_id: latest?.runId ?? "",
          run_name: latest?.runName ?? "",
          test_id: latest?.testId ?? "",
          latest_status: latest?.result?.status ?? "untested",
          latest_result_at: latest?.result?.createdAt?.toISOString() ?? "",
          defects: latest?.result?.defectLinks.map((d) => d.defectKey).join("|") ?? ""
        };
      })
    );
    return {
      fileName: `project-${projectId.toString()}-traceability.csv`,
      csv: toCsv(
        ["requirement_id", "requirement_key", "requirement_title", "case_id", "case_title", "run_id", "run_name", "test_id", "latest_status", "latest_result_at", "defects"],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "case_activity_summary") {
    const query = caseActivitySummaryQuerySchema.parse({
      days: input.days ?? 30,
      ...(input.actorUserId != null ? { actorUserId: input.actorUserId } : {}),
      ...(input.category ? { category: input.category } : {})
    });
    const summary = await buildCaseActivitySummaryReport(prisma, projectId, query);
    const rows = summary.recent.map((row) => ({
      event_id: row.id,
      event_type: row.eventType,
      category: row.category,
      case_id: row.caseId,
      title: row.title,
      body: row.body ?? "",
      actor_user_id: row.actorUserId ?? "",
      actor_name: row.actorName,
      created_at: row.createdAt
    }));
    return {
      fileName: `project-${projectId.toString()}-case-activity-summary.csv`,
      csv: toCsv(
        [
          "event_id",
          "event_type",
          "category",
          "case_id",
          "title",
          "body",
          "actor_user_id",
          "actor_name",
          "created_at"
        ],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "cases_property_distribution") {
    const report = await buildCasePropertyDistributionReport(projectId, { prisma }, input.field ?? "priority");
    const rows = report.items.slice(0, input.maxRows).map((row) => ({
      field: report.selectedField,
      value: row.value,
      label: row.label,
      count: row.count,
      percent: row.percent,
      total_cases: report.totalCases
    }));
    return {
      fileName: `project-${projectId.toString()}-cases-property-distribution.csv`,
      csv: toCsv(["field", "value", "label", "count", "percent", "total_cases"], rows),
      totalRows: rows.length
    };
  }

  if (input.reportType === "status_tops") {
    const report = await buildCaseStatusTopsReport(projectId, { prisma });
    const rows = report.items.slice(0, input.maxRows).map((row) => ({
      status: row.status,
      count: row.count,
      percent: row.percent,
      total_tests: report.totalTests
    }));
    return {
      fileName: `project-${projectId.toString()}-status-tops.csv`,
      csv: toCsv(["status", "count", "percent", "total_tests"], rows),
      totalRows: rows.length
    };
  }

  if (input.reportType === "coverage_gap") {
    const rows = requirements.map((reqRow) => {
      const latestStatuses = reqRow.caseLinks.map(
        (link) => latestByCreatedAt(link.testCase.instances.map((inst) => inst.results[0]))?.status ?? "untested"
      );
      return {
        requirement_id: reqRow.id,
        requirement_key: reqRow.key,
        requirement_title: reqRow.title,
        coverage_status: toCoverageStatus(latestStatuses, reqRow.caseLinks.length),
        linked_case_count: reqRow.caseLinks.length,
        latest_statuses: latestStatuses.join("|")
      };
    });
    return {
      fileName: `project-${projectId.toString()}-coverage-gap.csv`,
      csv: toCsv(["requirement_id", "requirement_key", "requirement_title", "coverage_status", "linked_case_count", "latest_statuses"], rows),
      totalRows: rows.length
    };
  }

  if (input.reportType === "results_case_comparison") {
    const query = resultsCaseComparisonQuerySchema.parse({
      runIdA: input.runIdA,
      runIdB: input.runIdB
    });
    const report = await buildResultsCaseComparisonReport(projectId, { prisma }, query);
    const rows = report.items.slice(0, input.maxRows).map((row) => ({
      run_a_id: report.runA.runId,
      run_a_name: report.runA.name,
      run_b_id: report.runB.runId,
      run_b_name: report.runB.name,
      case_id: row.caseId,
      title: row.title,
      status_a: row.statusA ?? "",
      status_b: row.statusB ?? "",
      changed: row.changed ? "yes" : "no",
      only_in_run_a: row.onlyInRunA ? "yes" : "no",
      only_in_run_b: row.onlyInRunB ? "yes" : "no"
    }));
    return {
      fileName: `project-${projectId.toString()}-results-case-comparison.csv`,
      csv: toCsv(
        [
          "run_a_id",
          "run_a_name",
          "run_b_id",
          "run_b_name",
          "case_id",
          "title",
          "status_a",
          "status_b",
          "changed",
          "only_in_run_a",
          "only_in_run_b"
        ],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "results_property_distribution") {
    const query = resultsPropertyDistributionQuerySchema.parse({
      field: input.field ?? "status",
      ...(input.runId != null ? { runId: input.runId } : {})
    });
    const report = await buildResultsPropertyDistributionReport(projectId, { prisma }, query);
    const rows = report.items.slice(0, input.maxRows).map((row) => ({
      field: report.selectedField,
      run_id: report.runId ?? "",
      value: row.value,
      label: row.label,
      count: row.count,
      percent: row.percent,
      total_results: report.totalResults
    }));
    return {
      fileName: `project-${projectId.toString()}-results-property-distribution.csv`,
      csv: toCsv(["field", "run_id", "value", "label", "count", "percent", "total_results"], rows),
      totalRows: rows.length
    };
  }

  if (input.reportType === "refs_coverage") {
    const report = await buildRefsCoverageReportForProject(projectId, { prisma });
    const rows = report.items.slice(0, input.maxRows).map((row) => ({
      ref_key: row.refKey,
      linked_case_count: row.linkedCaseCount,
      coverage_status: row.coverageStatus,
      latest_statuses: row.latestStatuses.join("|"),
      case_ids: row.caseIds.join("|")
    }));
    return {
      fileName: `project-${projectId.toString()}-refs-coverage.csv`,
      csv: toCsv(
        ["ref_key", "linked_case_count", "coverage_status", "latest_statuses", "case_ids"],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "refs_comparison") {
    const query = refsComparisonQuerySchema.parse({
      runIdA: input.runIdA,
      runIdB: input.runIdB
    });
    const report = await buildRefsComparisonReportForProject(projectId, { prisma }, query);
    const rows = report.items.slice(0, input.maxRows).map((row) => ({
      run_a_id: report.runA.runId,
      run_a_name: report.runA.name,
      run_b_id: report.runB.runId,
      run_b_name: report.runB.name,
      ref_key: row.refKey,
      linked_case_count: row.linkedCaseCount,
      status_a: row.statusA ?? "",
      status_b: row.statusB ?? "",
      changed: row.changed ? "yes" : "no",
      case_ids: row.caseIds.join("|")
    }));
    return {
      fileName: `project-${projectId.toString()}-refs-comparison.csv`,
      csv: toCsv(
        [
          "run_a_id",
          "run_a_name",
          "run_b_id",
          "run_b_name",
          "ref_key",
          "linked_case_count",
          "status_a",
          "status_b",
          "changed",
          "case_ids"
        ],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "refs_defect_summary") {
    const report = await buildRefsDefectSummaryReportForProject(projectId, { prisma });
    const rows = report.items.slice(0, input.maxRows).map((row) => ({
      ref_key: row.refKey,
      linked_case_count: row.linkedCaseCount,
      at_risk_result_count: row.atRiskResultCount,
      linked_defect_count: row.linkedDefectCount,
      defect_coverage: row.defectCoverage,
      defect_keys: row.defectKeys.join("|"),
      case_ids: row.caseIds.join("|")
    }));
    return {
      fileName: `project-${projectId.toString()}-refs-defect-summary.csv`,
      csv: toCsv(
        [
          "ref_key",
          "linked_case_count",
          "at_risk_result_count",
          "linked_defect_count",
          "defect_coverage",
          "defect_keys",
          "case_ids"
        ],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "project_summary") {
    const repo = new PrismaRunsRepository(prisma);
    const report = await buildProjectExecutionSummaryForProject(projectId, { prisma, repo });
    const executionRows = [
      {
        row_kind: "execution",
        total_cases: report.totalCases,
        automation_coverage_pct: report.automationCoveragePct,
        total_runs: report.totalRuns,
        active_runs: report.activeRuns,
        completed_runs: report.completedRuns,
        tests_total: report.execution.total,
        tests_passed: report.execution.passed,
        tests_failed: report.execution.failed,
        tests_blocked: report.execution.blocked,
        tests_retest: report.execution.retest,
        tests_untested: report.execution.untested,
        progress: report.execution.progress,
        run_id: "",
        run_name: "",
        run_status: "",
        run_total: "",
        run_passed: "",
        run_failed: "",
        run_progress: ""
      },
      ...report.runs.slice(0, input.maxRows).map((row) => ({
        row_kind: "run",
        total_cases: report.totalCases,
        automation_coverage_pct: report.automationCoveragePct,
        total_runs: report.totalRuns,
        active_runs: report.activeRuns,
        completed_runs: report.completedRuns,
        tests_total: report.execution.total,
        tests_passed: report.execution.passed,
        tests_failed: report.execution.failed,
        tests_blocked: report.execution.blocked,
        tests_retest: report.execution.retest,
        tests_untested: report.execution.untested,
        progress: report.execution.progress,
        run_id: row.runId,
        run_name: row.name,
        run_status: row.status,
        run_total: row.total,
        run_passed: row.passed,
        run_failed: row.failed,
        run_progress: row.progress
      }))
    ];
    return {
      fileName: `project-${projectId.toString()}-project-summary.csv`,
      csv: toCsv(
        [
          "row_kind",
          "total_cases",
          "automation_coverage_pct",
          "total_runs",
          "active_runs",
          "completed_runs",
          "tests_total",
          "tests_passed",
          "tests_failed",
          "tests_blocked",
          "tests_retest",
          "tests_untested",
          "progress",
          "run_id",
          "run_name",
          "run_status",
          "run_total",
          "run_passed",
          "run_failed",
          "run_progress"
        ],
        executionRows
      ),
      totalRows: executionRows.length
    };
  }

  if (input.reportType === "users_workload_summary") {
    const repo = new PrismaRunsRepository(prisma);
    const report = await buildUserWorkloadSummaryForProject(projectId, { prisma, repo });
    const rows = [
      {
        row_kind: "totals",
        user_id: "",
        name: "",
        email: "",
        assigned_count: report.totalAssignedTests,
        active_count: report.totalActiveTests,
        unassigned_active_count: report.unassignedActiveCount,
        passed_count: "",
        failed_count: "",
        blocked_count: "",
        retest_count: "",
        untested_count: "",
        overdue_count: "",
        due_soon_count: "",
        stale_count: ""
      },
      ...report.items.slice(0, input.maxRows).map((row) => ({
        row_kind: "user",
        user_id: row.userId,
        name: row.name,
        email: row.email,
        assigned_count: row.assignedCount,
        active_count: row.activeCount,
        unassigned_active_count: report.unassignedActiveCount,
        passed_count: row.passedCount,
        failed_count: row.failedCount,
        blocked_count: row.blockedCount,
        retest_count: row.retestCount,
        untested_count: row.untestedCount,
        overdue_count: row.overdueCount,
        due_soon_count: row.dueSoonCount,
        stale_count: row.staleCount
      }))
    ];
    return {
      fileName: `project-${projectId.toString()}-users-workload-summary.csv`,
      csv: toCsv(
        [
          "row_kind",
          "user_id",
          "name",
          "email",
          "assigned_count",
          "active_count",
          "unassigned_active_count",
          "passed_count",
          "failed_count",
          "blocked_count",
          "retest_count",
          "untested_count",
          "overdue_count",
          "due_soon_count",
          "stale_count"
        ],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "defect_summary") {
    const query = defectSummaryQuerySchema.parse({
      ...(input.runId != null ? { runId: input.runId } : {}),
      ...(input.milestoneId != null ? { milestoneId: input.milestoneId } : {}),
      ...(input.planId != null ? { planId: input.planId } : {})
    });
    const report = await buildDefectSummaryReportForProject(projectId, { prisma }, query);
    const rows = [
      ...report.defects.map((row) => ({
        row_kind: "defect",
        scope_type: report.scope.type,
        scope_label: report.scope.label,
        defect_key: row.defectKey,
        linked_result_count: row.linkedResultCount,
        failed_count: row.failedCount,
        blocked_count: row.blockedCount,
        retest_count: row.retestCount,
        run_id: "",
        run_name: "",
        test_id: "",
        case_id: "",
        title: "",
        status: "",
        result_id: "",
        created_at: ""
      })),
      ...report.unlinkedAtRisk.map((row) => ({
        row_kind: "unlinked_at_risk",
        scope_type: report.scope.type,
        scope_label: report.scope.label,
        defect_key: "",
        linked_result_count: "",
        failed_count: "",
        blocked_count: "",
        retest_count: "",
        run_id: row.runId,
        run_name: row.runName,
        test_id: row.testId,
        case_id: row.caseId,
        title: row.title,
        status: row.status,
        result_id: row.resultId,
        created_at: row.createdAt
      }))
    ].slice(0, input.maxRows);
    return {
      fileName: `project-${projectId.toString()}-defect-summary.csv`,
      csv: toCsv(
        [
          "row_kind",
          "scope_type",
          "scope_label",
          "defect_key",
          "linked_result_count",
          "failed_count",
          "blocked_count",
          "retest_count",
          "run_id",
          "run_name",
          "test_id",
          "case_id",
          "title",
          "status",
          "result_id",
          "created_at"
        ],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType !== "defect_coverage") {
    throw new Error(`Unsupported report export type: ${input.reportType}`);
  }

  const rows = requirements.map((reqRow) => {
    const latestResults = reqRow.caseLinks
      .map((link) => {
        return latestByCreatedAt(link.testCase.instances.map((inst) => inst.results[0])) ?? null;
      })
      .filter(Boolean);
    const defectKeys = toUniqueDefectKeys(latestResults);
    const atRiskResultCount = latestResults.filter((result) =>
      result.status === "failed" || result.status === "blocked" || result.status === "retest"
    ).length;
    return {
      requirement_id: reqRow.id,
      requirement_key: reqRow.key,
      requirement_title: reqRow.title,
      linked_case_count: reqRow.caseLinks.length,
      at_risk_result_count: atRiskResultCount,
      linked_defect_count: defectKeys.length,
      defect_keys: defectKeys.join("|"),
      defect_coverage: atRiskResultCount === 0 ? "not_applicable" : defectKeys.length > 0 ? "linked" : "unlinked"
    };
  });
  return {
    fileName: `project-${projectId.toString()}-defect-coverage.csv`,
    csv: toCsv(["requirement_id", "requirement_key", "requirement_title", "linked_case_count", "at_risk_result_count", "linked_defect_count", "defect_keys", "defect_coverage"], rows),
    totalRows: rows.length
  };
}

async function validateImportRows(prisma: PrismaClient, projectId: bigint, rows: CsvRow[], fallbackSectionId?: bigint) {
  const issues: ImportIssue[] = [];
  const customFields = await prisma.customField.findMany({
    where: { projectId, scope: "case", deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: { systemName: true, fieldType: true, options: true, isRequired: true }
  });
  const normalized: Array<{
    rowNumber: number;
    sectionId: bigint;
    title: string;
    preconditions?: string;
    mission?: string;
    goals?: string;
    ai_input?: string;
    ai_expected_output?: string;
    priority?: string;
    caseType?: string;
    refs?: string;
    labels: string[];
    automationKey?: string;
    externalId?: string;
    customValues: Record<string, ScalarCustomValue>;
    steps: Array<{ content: string; expectedResult?: string | null }>;
  }> = [];

  const defaultSectionId = fallbackSectionId ?? (await resolveDefaultSection(prisma, projectId));
  const sectionIds = new Set(
    (
      await prisma.section.findMany({
        where: { suite: { projectId }, deletedAt: null },
        select: { id: true }
      })
    ).map((row) => row.id.toString())
  );

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const title = firstValue(row, ["title", "Title"]);
    const rawSectionId = firstValue(row, ["section_id", "sectionId", "Section ID"]);
    const sectionId = rawSectionId ? BigInt(rawSectionId) : defaultSectionId;

    if (!title) {
      issues.push({ row: rowNumber, field: "title", code: "REQUIRED", message: "title is required" });
    }
    if (!sectionId) {
      issues.push({ row: rowNumber, field: "section_id", code: "REQUIRED", message: "section_id is required when the project has no default section" });
      return;
    }
    if (!sectionIds.has(sectionId.toString())) {
      issues.push({ row: rowNumber, field: "section_id", code: "INVALID_SECTION", message: `section ${sectionId.toString()} is not in this project` });
    }
    if (!title || !sectionIds.has(sectionId.toString())) return;

    const rowIssueStart = issues.length;
    const steps = splitList(firstValue(row, ["steps", "Steps"])).map((step) => {
      const [content, expected] = step.split("=>").map((part) => part.trim());
      return { content: content ?? step, expectedResult: expected || null };
    });
    const customValues = extractCustomValues(row, customFields, rowNumber, issues);
    if (issues.length > rowIssueStart) return;

    normalized.push({
      rowNumber,
      sectionId,
      title,
      preconditions: firstValue(row, ["preconditions", "Preconditions"]),
      mission: firstValue(row, ["mission", "Mission", "charter", "Charter"]),
      goals: firstValue(row, ["goals", "Goals", "goal", "Goal"]),
      ai_input: firstValue(row, ["ai_input", "aiInput", "AI Input", "input", "Input"]),
      ai_expected_output: firstValue(row, [
        "ai_expected_output",
        "aiExpectedOutput",
        "AI Expected Output",
        "expected_output",
        "Expected Output"
      ]),
      priority: firstValue(row, ["priority", "Priority"]),
      caseType: firstValue(row, ["type", "case_type", "caseType", "Type"]),
      refs: caseRefsFromCsvCell(firstValue(row, [...caseRefsCsvAliases()])) ?? undefined,
      labels: splitList(firstValue(row, ["labels", "Labels"])),
      automationKey: firstValue(row, ["automation_key", "automationKey"]),
      externalId: firstValue(row, ["external_id", "externalId"]),
      customValues,
      steps
    });
  });

  return { issues, normalized };
}

export class ImportExportService {
  constructor(private readonly prisma?: PrismaClient) {}

  getPrisma() {
    if (!this.prisma) throw new AppError("NOT_IMPLEMENTED", "feature requires prisma mode", 501);
    return this.prisma;
  }

  async createCaseImportJob(input: {
    projectId: bigint;
    userId: bigint;
    importType?: CaseImportFormat;
    dryRun: boolean;
    summary: Prisma.InputJsonValue;
    issues: Prisma.InputJsonValue;
    status: "pending" | "processing" | "failed" | "completed" | "completed_with_errors";
  }) {
    const prisma = this.getPrisma();
    return prisma.importJob.create({
      data: {
        projectId: input.projectId,
        type: `cases_${input.importType ?? "csv"}`,
        status: input.status,
        dryRun: input.dryRun,
        summary: input.summary,
        errors: input.issues,
        createdBy: input.userId
      }
    });
  }

  async getImportJob(projectId: bigint, jobId: bigint) {
    const prisma = this.getPrisma();
    const job = await prisma.importJob.findFirst({ where: { id: jobId, projectId } });
    if (!job) throw new AppError("NOT_FOUND", `import job ${jobId.toString()} not found`, 404);
    return job;
  }

  async updateImportJob(
    projectId: bigint,
    jobId: bigint,
    data: {
      status?: string;
      summary?: Prisma.InputJsonValue;
      issues?: Prisma.InputJsonValue;
      dryRun?: boolean;
    }
  ) {
    const prisma = this.getPrisma();
    await this.getImportJob(projectId, jobId);
    return prisma.importJob.update({
      where: { id: jobId },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.issues !== undefined ? { errors: data.issues } : {}),
        ...(data.dryRun !== undefined ? { dryRun: data.dryRun } : {})
      }
    });
  }

  async getExportJob(projectId: bigint, jobId: bigint) {
    const prisma = this.getPrisma();
    const job = await prisma.exportJob.findFirst({ where: { id: jobId, projectId } });
    if (!job) throw new AppError("NOT_FOUND", `export job ${jobId.toString()} not found`, 404);
    return job;
  }

  async updateExportJob(
    projectId: bigint,
    jobId: bigint,
    data: { status?: string; summary?: Prisma.InputJsonValue; filters?: Prisma.InputJsonValue }
  ) {
    const prisma = this.getPrisma();
    await this.getExportJob(projectId, jobId);
    return prisma.exportJob.update({
      where: { id: jobId },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.filters !== undefined ? { filters: data.filters } : {})
      }
    });
  }

  async importValidatedCases(projectId: bigint, userId: bigint, normalized: Array<{
    sectionId: bigint;
    title: string;
    preconditions?: string;
    mission?: string;
    goals?: string;
    ai_input?: string;
    ai_expected_output?: string;
    priority?: string;
    caseType?: string;
    refs?: string;
    labels: string[];
    automationKey?: string;
    externalId?: string;
    customValues: Record<string, ScalarCustomValue>;
    steps: Array<{ content: string; expectedResult?: string | null }>;
  }>, importType: CaseImportFormat = "csv") {
    const prisma = this.getPrisma();
    return prisma.$transaction(async (tx) => {
      const created = [];
      for (const item of normalized) {
        const section = await tx.section.findUnique({
          where: { id: item.sectionId },
          select: { suiteId: true, suite: { select: { projectId: true } } }
        });
        if (!section || section.suite.projectId !== projectId) continue;
        const testCase = await tx.testCase.create({
          data: {
            projectId,
            suiteId: section.suiteId,
            sectionId: item.sectionId,
            title: item.title,
            preconditions: item.preconditions,
            mission: item.mission,
            goals: item.goals,
            aiInput: item.ai_input,
            aiExpectedOutput: item.ai_expected_output,
            priority: item.priority,
            caseType: item.caseType,
            refs: item.refs,
            labels: item.labels,
            automationKey: item.automationKey,
            externalId: item.externalId,
            customValues: item.customValues,
            createdBy: userId,
            updatedBy: userId,
            steps: {
              create: item.steps.map((step, index) => ({
                stepOrder: index + 1,
                content: step.content,
                expectedResult: step.expectedResult
              }))
            }
          }
        });
        await tx.testCaseVersion.create({
          data: {
            caseId: testCase.id,
            versionNo: 1,
            title: item.title,
            priority: item.priority,
            caseType: item.caseType,
            preconditions: item.preconditions,
            customValuesSnapshot: item.customValues as Prisma.InputJsonValue,
            stepsSnapshot: item.steps.map((step, index) => ({ stepOrder: index + 1, ...step })) as Prisma.InputJsonValue,
            changeReason: `${importType}_import`
          }
        });
        created.push(testCase.id);
      }
      return created;
    });
  }

  async listImportJobs(projectId: bigint, page: number, pageSize: number) {
    const prisma = this.getPrisma();
    const where = { projectId };
    const [rows, total] = await prisma.$transaction([
      prisma.importJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.importJob.count({ where })
    ]);
    return { rows, total };
  }

  async listExportJobs(projectId: bigint, page: number, pageSize: number, typePrefix?: string) {
    const prisma = this.getPrisma();
    const where = {
      projectId,
      ...(typePrefix ? { type: { startsWith: typePrefix } } : {})
    };
    const [rows, total] = await prisma.$transaction([
      prisma.exportJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.exportJob.count({ where })
    ]);
    return { rows, total };
  }

  async createReportExportJob(projectId: bigint, userId: bigint, body: z.infer<typeof reportExportSchema>) {
    const prisma = this.getPrisma();
    return prisma.exportJob.create({
      data: {
        projectId,
        type: `report_${body.reportType}_csv`,
        filters: normalizeReportFilters(body) as Prisma.InputJsonValue,
        status: "pending",
        summary: { format: body.format, maxRows: body.maxRows } as Prisma.InputJsonValue,
        createdBy: userId
      }
    });
  }

  async buildAdHocReportExport(projectId: bigint, userId: bigint, query: z.infer<typeof reportExportSchema>) {
    const prisma = this.getPrisma();
    const exported = await buildReportExport(prisma, projectId, query);
    const job = await prisma.exportJob.create({
      data: {
        projectId,
        type: `report_${query.reportType}_csv`,
        filters: normalizeReportFilters(query) as Prisma.InputJsonValue,
        status: "completed",
        summary: {
          totalRows: exported.totalRows,
          fileName: exported.fileName,
          contentType: "text/csv"
        } as Prisma.InputJsonValue,
        createdBy: userId
      }
    });
    return { exported, job };
  }

  async buildReportExportFromJob(projectId: bigint, jobId: bigint) {
    const prisma = this.getPrisma();
    const job = await prisma.exportJob.findFirst({ where: { id: jobId, projectId } });
    if (!job) throw new AppError("NOT_FOUND", `export job ${jobId.toString()} not found`, 404);
    if (!job.type.startsWith("report_")) {
      throw new AppError("VALIDATION_ERROR", "only report export jobs can be downloaded by job id", 400);
    }
    const filters = parseReportFilters(job.filters);
    const exported = await buildReportExport(prisma, projectId, filters);
    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        summary: {
          totalRows: exported.totalRows,
          fileName: exported.fileName,
          contentType: "text/csv"
        } as Prisma.InputJsonValue
      }
    });
    return exported;
  }

  async getCaseExportRecords(projectId: bigint) {
    const prisma = this.getPrisma();
    const rows = await prisma.testCase.findMany({
      where: { projectId, archivedAt: null, deletedAt: null },
      orderBy: { id: "asc" },
      include: { steps: { where: { deletedAt: null }, orderBy: { stepOrder: "asc" } } }
    });
    const customFields = await prisma.customField.findMany({
      where: { projectId, scope: "case", deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { systemName: true }
    });
    const customFieldNames = customFields.map((field) => field.systemName);
    const records: CaseExportRecord[] = rows.map((row) => ({
      id: row.id.toString(),
      section_id: row.sectionId.toString(),
      title: row.title,
      preconditions: row.preconditions,
      mission: row.mission,
      goals: row.goals,
      ai_input: row.aiInput,
      ai_expected_output: row.aiExpectedOutput,
      priority: row.priority,
      type: row.caseType,
      refs: formatCaseRefsForCsv(row.refs),
      labels: row.labels,
      automation_key: row.automationKey,
      external_id: row.externalId,
      customValues: Object.fromEntries(
        customFieldNames.map((fieldName) => {
          const value =
            row.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues)
              ? (row.customValues as Record<string, unknown>)[fieldName]
              : undefined;
          return [fieldName, value ?? ""];
        })
      ),
      steps: row.steps.map((step) => ({
        content: step.content,
        expected_result: step.expectedResult
      }))
    }));
    return { records, customFieldNames };
  }

  async exportCasesCsv(
    projectId: bigint,
    userId: bigint,
    options?: { existingJobId?: bigint; recordJob?: boolean }
  ) {
    const prisma = this.getPrisma();
    const { records, customFieldNames } = await this.getCaseExportRecords(projectId);
    const headers = [
      "id",
      "section_id",
      "title",
      "preconditions",
      "mission",
      "goals",
      "ai_input",
      "ai_expected_output",
      "priority",
      "type",
      CASE_CSV_REFS_COLUMN,
      "labels",
      "automation_key",
      "external_id",
      ...customFieldNames.map((fieldName) => customColumnName(fieldName)),
      "steps"
    ];
    const csv = toCsv(headers, records.map((record) => caseExportRecordToCsvRow(record, customFieldNames)));
    const recordJob = options?.recordJob !== false;
    const summary = {
      totalRows: records.length,
      contentType: "text/csv",
      fileName: `project-${projectId.toString()}-cases.csv`
    } as Prisma.InputJsonValue;
    if (recordJob) {
      if (options?.existingJobId) {
        await prisma.exportJob.update({
          where: { id: options.existingJobId },
          data: { status: "completed", summary }
        });
      } else {
        await prisma.exportJob.create({
          data: {
            projectId,
            type: "cases_csv",
            status: "completed",
            summary,
            createdBy: userId
          }
        });
      }
    }
    return csv;
  }

  async exportCasesJson(
    projectId: bigint,
    userId: bigint,
    options?: { existingJobId?: bigint; recordJob?: boolean }
  ) {
    const prisma = this.getPrisma();
    const { records } = await this.getCaseExportRecords(projectId);
    const json = casesToJsonExport(projectId, records);
    const recordJob = options?.recordJob !== false;
    const summary = {
      totalRows: records.length,
      contentType: "application/json",
      fileName: `project-${projectId.toString()}-cases.json`
    } as Prisma.InputJsonValue;
    if (recordJob) {
      if (options?.existingJobId) {
        await prisma.exportJob.update({ where: { id: options.existingJobId }, data: { status: "completed", summary } });
      } else {
        await prisma.exportJob.create({
          data: {
            projectId,
            type: "cases_json",
            status: "completed",
            summary,
            createdBy: userId
          }
        });
      }
    }
    return json;
  }

  async exportCasesTestRailJson(projectId: bigint, userId: bigint) {
    const prisma = this.getPrisma();
    const { records, customFieldNames } = await this.getCaseExportRecords(projectId);
    const json = casesToTestRailExport(records, customFieldNames);
    await prisma.exportJob.create({
      data: {
        projectId,
        type: "cases_testrail",
        status: "completed",
        summary: { totalRows: records.length, contentType: "application/json", compatibilityOnly: true } as Prisma.InputJsonValue,
        createdBy: userId
      }
    });
    return json;
  }

  async exportCasesXml(
    projectId: bigint,
    userId: bigint,
    options?: { existingJobId?: bigint; recordJob?: boolean }
  ) {
    const prisma = this.getPrisma();
    const { records } = await this.getCaseExportRecords(projectId);
    const xml = casesToXmlExport(projectId, records);
    const recordJob = options?.recordJob !== false;
    const summary = {
      totalRows: records.length,
      contentType: "application/xml",
      fileName: `project-${projectId.toString()}-cases.xml`
    } as Prisma.InputJsonValue;
    if (recordJob) {
      if (options?.existingJobId) {
        await prisma.exportJob.update({ where: { id: options.existingJobId }, data: { status: "completed", summary } });
      } else {
        await prisma.exportJob.create({
          data: {
            projectId,
            type: "cases_xml",
            status: "completed",
            summary,
            createdBy: userId
          }
        });
      }
    }
    return xml;
  }

  async getRunResultExportRecords(projectId: bigint, runId: bigint) {
    const prisma = this.getPrisma();
    const run = await prisma.testRun.findFirst({ where: { id: runId, projectId, deletedAt: null } });
    if (!run) throw new AppError("NOT_FOUND", `run ${runId.toString()} not found`, 404);
    const rows = await prisma.testResult.findMany({
      where: { instance: { runId } },
      orderBy: { createdAt: "desc" },
      include: {
        instance: { include: { testCase: { select: { refs: true } } } },
        defectLinks: { where: { deletedAt: null } }
      }
    });
    const customFields = await prisma.customField.findMany({
      where: { projectId, scope: "result", deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { systemName: true }
    });
    const customFieldNames = customFields.map((field) => field.systemName);
    const records: RunResultExportRecord[] = rows.map((row) => ({
      result_id: row.id.toString(),
      test_id: row.testInstanceId.toString(),
      case_id: row.instance.caseId.toString(),
      refs: formatCaseRefsForCsv(row.instance.testCase.refs),
      status: row.status,
      status_id: statusIdForCanonical(row.status),
      comment: row.comment,
      elapsed: row.elapsed,
      version: row.version,
      source: row.source,
      defects: [...row.defects, ...row.defectLinks.map((link) => link.defectKey)].filter(Boolean),
      customValues: Object.fromEntries(
        customFieldNames.map((fieldName) => [fieldName, customValueFromJson(row.customValues, fieldName)])
      ),
      created_at: row.createdAt.toISOString(),
      created_on: Math.floor(row.createdAt.getTime() / 1000)
    }));
    return { run, records, customFieldNames };
  }

  async exportRunResultsCsv(
    projectId: bigint,
    runId: bigint,
    userId: bigint,
    options?: { existingJobId?: bigint; recordJob?: boolean }
  ) {
    const prisma = this.getPrisma();
    const { records, customFieldNames } = await this.getRunResultExportRecords(projectId, runId);
    const customHeaders = customFieldNames.map((fieldName) => customColumnName(fieldName));
    const csv = toCsv(
      [
        "result_id",
        "test_id",
        "case_id",
        CASE_CSV_REFS_COLUMN,
        "status",
        "comment",
        "elapsed",
        "version",
        "source",
        "defects",
        ...customHeaders,
        "created_at"
      ],
      records.map((record) => runResultRecordToCsvRow(record, customFieldNames))
    );
    const recordJob = options?.recordJob !== false;
    const summary = {
      totalRows: records.length,
      contentType: "text/csv",
      fileName: `run-${runId.toString()}-results.csv`
    } as Prisma.InputJsonValue;
    const filters = { runId: runId.toString() } as Prisma.InputJsonValue;
    if (recordJob) {
      if (options?.existingJobId) {
        await prisma.exportJob.update({
          where: { id: options.existingJobId },
          data: { status: "completed", summary, filters }
        });
      } else {
        await prisma.exportJob.create({
          data: {
            projectId,
            type: "run_results_csv",
            filters,
            status: "completed",
            summary,
            createdBy: userId
          }
        });
      }
    }
    return csv;
  }

  async buildExportDownload(projectId: bigint, jobId: bigint) {
    const job = await this.getExportJob(projectId, jobId);
    if (job.type.startsWith("report_")) {
      const exported = await this.buildReportExportFromJob(projectId, jobId);
      return {
        fileName: exported.fileName,
        contentType: "text/csv; charset=utf-8",
        body: exported.csv
      };
    }
    if (job.status !== "completed") {
      throw new AppError("CONFLICT", `export job ${jobId.toString()} is not ready (status: ${job.status})`, 409);
    }
    const summary =
      job.summary && typeof job.summary === "object" && !Array.isArray(job.summary)
        ? (job.summary as Record<string, unknown>)
        : {};
    const userId = job.createdBy ?? 0n;
    if (job.type === "cases_csv") {
      const csv = await this.exportCasesCsv(projectId, userId, { recordJob: false });
      return {
        fileName: String(summary.fileName ?? `project-${projectId.toString()}-cases.csv`),
        contentType: "text/csv; charset=utf-8",
        body: csv
      };
    }
    if (job.type === "cases_json") {
      const json = await this.exportCasesJson(projectId, userId, { recordJob: false });
      return {
        fileName: String(summary.fileName ?? `project-${projectId.toString()}-cases.json`),
        contentType: "application/json; charset=utf-8",
        body: json
      };
    }
    if (job.type === "cases_xml") {
      const xml = await this.exportCasesXml(projectId, userId, { recordJob: false });
      return {
        fileName: String(summary.fileName ?? `project-${projectId.toString()}-cases.xml`),
        contentType: "application/xml; charset=utf-8",
        body: xml
      };
    }
    if (job.type === "run_results_csv") {
      const filters = job.filters && typeof job.filters === "object" ? (job.filters as Record<string, unknown>) : {};
      const runId = filters.runId ? BigInt(String(filters.runId)) : null;
      if (!runId) throw new AppError("VALIDATION_ERROR", "run_results_csv job is missing runId filter", 400);
      const csv = await this.exportRunResultsCsv(projectId, runId, userId, { recordJob: false });
      return {
        fileName: String(summary.fileName ?? `run-${runId.toString()}-results.csv`),
        contentType: "text/csv; charset=utf-8",
        body: csv
      };
    }
    if (job.type === "attachments_json") {
      const json = await this.exportAttachmentsJson(projectId, userId, {}, { recordJob: false });
      return {
        fileName: String(summary.fileName ?? `project-${projectId.toString()}-attachments.json`),
        contentType: "application/json; charset=utf-8",
        body: json
      };
    }
    throw new AppError("VALIDATION_ERROR", `export type ${job.type} cannot be downloaded by job id`, 400);
  }

  async exportAttachmentsJson(
    projectId: bigint,
    userId: bigint,
    filters: {
      caseId?: bigint;
      runId?: bigint;
      includeContent?: boolean;
      includeDownloadUrls?: boolean;
    } = {},
    options: { existingJobId?: bigint; recordJob?: boolean } = {}
  ) {
    const prisma = this.getPrisma();
    const manifest = await buildProjectAttachmentManifest(prisma, projectId, {
      caseId: filters.caseId,
      runId: filters.runId,
      includeContent: filters.includeContent,
      includeDownloadUrls: filters.includeDownloadUrls
    });
    const json = serializeAttachmentManifest(manifest);
    const summary = {
      attachmentCount: manifest.attachments.length,
      includeContent: Boolean(filters.includeContent),
      fileName: `project-${projectId.toString()}-attachments.json`
    } as Prisma.InputJsonValue;
    const recordJob = options.recordJob ?? true;
    if (recordJob) {
      if (options.existingJobId) {
        await prisma.exportJob.update({
          where: { id: options.existingJobId },
          data: {
            status: "completed",
            summary,
            filters: {
              caseId: filters.caseId?.toString() ?? null,
              runId: filters.runId?.toString() ?? null,
              includeContent: filters.includeContent ?? false
            } as Prisma.InputJsonValue
          }
        });
      } else {
        await prisma.exportJob.create({
          data: {
            projectId,
            type: "attachments_json",
            status: "completed",
            summary,
            filters: {
              caseId: filters.caseId?.toString() ?? null,
              runId: filters.runId?.toString() ?? null
            } as Prisma.InputJsonValue,
            createdBy: userId
          }
        });
      }
    }
    return json;
  }

  async importAttachmentsFromManifest(
    projectId: bigint,
    userId: bigint,
    manifestRaw: string,
    options: { dryRun?: boolean; replaceExisting?: boolean } = {}
  ) {
    const prisma = this.getPrisma();
    const manifest = parseAttachmentManifestJson(manifestRaw);
    const result = await importAttachmentManifest(prisma, projectId, userId, manifest, options);
    const job = await prisma.importJob.create({
      data: {
        projectId,
        type: "attachments_json",
        dryRun: options.dryRun ?? false,
        status: result.issues.length > 0 ? "completed_with_errors" : "completed",
        summary: result.summary as Prisma.InputJsonValue,
        errors: result.issues as Prisma.InputJsonValue,
        createdBy: userId
      }
    });
    return { job, ...result };
  }

  async exportRunResultsTestRailJson(projectId: bigint, runId: bigint, userId: bigint) {
    const prisma = this.getPrisma();
    const { records, customFieldNames } = await this.getRunResultExportRecords(projectId, runId);
    const json = runResultsToTestRailExport(runId, records, customFieldNames);
    await prisma.exportJob.create({
      data: {
        projectId,
        type: "run_results_testrail",
        filters: { runId: runId.toString() } as Prisma.InputJsonValue,
        status: "completed",
        summary: { totalRows: records.length, contentType: "application/json", compatibilityOnly: true } as Prisma.InputJsonValue,
        createdBy: userId
      }
    });
    return json;
  }
}

async function runCaseCsvImport(
  importExportService: ImportExportService,
  activityPrisma: PrismaClient | undefined,
  input: {
    projectId: bigint;
    userId: bigint;
    body: z.infer<typeof caseImportSchema>;
    existingJobId?: bigint;
    jobStatus?: "pending" | "processing" | "failed" | "completed" | "completed_with_errors";
  }
) {
  const prisma = importExportService.getPrisma();
  const body = input.body;

  const customFieldRows = await prisma.customField.findMany({
    where: { projectId: input.projectId, scope: "case", deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: { systemName: true, name: true, isRequired: true }
  });
  const customFields = customFieldRows.map((field) => ({ ...field, label: field.name }));

  const parsedRows = parseCsv(body.csv);
  const headers = extractCsvHeaders(body.csv);
  const columnMapping =
    body.columnMapping ??
    (headers.length > 0 ? suggestCaseCsvColumnMapping(headers, customFields) : undefined);
  const rows = applyCaseCsvColumnMapping(parsedRows, columnMapping);

  const mappingIssues = validateCaseCsvColumnMapping(
    columnMapping ?? {},
    customFields.map((field) => ({ systemName: field.systemName, isRequired: field.isRequired }))
  ).map((issue) => ({ row: 1, field: issue.field, code: issue.code, message: issue.message }));

  const { issues: rowIssues, normalized } = await validateImportRows(prisma, input.projectId, rows, body.sectionId);
  const issues = [...mappingIssues, ...rowIssues];
  const summary = { totalRows: parsedRows.length, validRows: normalized.length, invalidRows: issues.length, imported: 0 };

  if (body.dryRun || (body.atomic && issues.length > 0)) {
    const finalStatus = input.jobStatus ?? (issues.length > 0 ? "failed" : "completed");
    const job = input.existingJobId
      ? await importExportService.updateImportJob(input.projectId, input.existingJobId, {
          status: finalStatus,
          summary: summary as Prisma.InputJsonValue,
          issues: issues as Prisma.InputJsonValue,
          dryRun: body.dryRun
        })
      : await importExportService.createCaseImportJob({
          projectId: input.projectId,
          userId: input.userId,
          dryRun: body.dryRun,
          summary: summary as Prisma.InputJsonValue,
          issues: issues as Prisma.InputJsonValue,
          status: finalStatus
        });
    const status = !body.dryRun && body.atomic && issues.length > 0 ? 400 : 200;
    await recordActivityEvent(activityPrisma, {
      projectId: input.projectId,
      actorUserId: input.userId,
      entityType: "import",
      entityId: job.id,
      eventType: "import.cases_csv_validated",
      title: "Case CSV import validated",
      body: `valid ${normalized.length} · invalid ${issues.length}`,
      payload: {
        dryRun: body.dryRun,
        atomic: body.atomic,
        totalRows: rows.length,
        validRows: normalized.length,
        invalidRows: issues.length
      }
    });
    return {
      status,
      data: { job, summary, issues, columnMapping: columnMapping ?? null }
    };
  }

  const imported = await importExportService.importValidatedCases(input.projectId, input.userId, normalized);
  summary.imported = imported.length;
  const finalStatus = input.jobStatus ?? (issues.length > 0 ? "completed_with_errors" : "completed");
  const job = input.existingJobId
    ? await importExportService.updateImportJob(input.projectId, input.existingJobId, {
        status: finalStatus,
        summary: summary as Prisma.InputJsonValue,
        issues: issues as Prisma.InputJsonValue,
        dryRun: false
      })
    : await importExportService.createCaseImportJob({
        projectId: input.projectId,
        userId: input.userId,
        dryRun: false,
        summary: summary as Prisma.InputJsonValue,
        issues: issues as Prisma.InputJsonValue,
        status: finalStatus
      });
  await recordActivityEvent(activityPrisma, {
    projectId: input.projectId,
    actorUserId: input.userId,
    entityType: "import",
    entityId: job.id,
    eventType: "import.cases_csv_committed",
    title: "Case CSV import completed",
    body: `imported ${imported.length} · invalid ${issues.length}`,
    payload: {
      imported: imported.length,
      invalidRows: issues.length,
      totalRows: rows.length
    }
  });
  return {
    status: 200,
    data: { job, summary, issues, columnMapping: columnMapping ?? null }
  };
}

function scheduleCaseCsvImportJob(
  importExportService: ImportExportService,
  activityPrisma: PrismaClient | undefined,
  jobId: bigint,
  projectId: bigint
) {
  setImmediate(() => {
    void (async () => {
      const meta = takeCaseCsvImportMeta(jobId);
      if (!meta) return;
      try {
        await importExportService.updateImportJob(projectId, jobId, {
          status: "processing",
          summary: { phase: meta.dryRun ? "validating" : "importing" } as Prisma.InputJsonValue
        });
        const csv = await readStagedCsv(jobId);
        await runCaseCsvImport(importExportService, activityPrisma, {
          projectId: meta.projectId,
          userId: meta.userId,
          existingJobId: jobId,
          body: {
            csv,
            dryRun: meta.dryRun,
            atomic: meta.atomic,
            sectionId: meta.sectionId,
            columnMapping: meta.columnMapping
          }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "import failed";
        await importExportService.updateImportJob(projectId, jobId, {
          status: "failed",
          summary: { phase: "failed", message } as Prisma.InputJsonValue,
          issues: [{ row: 0, code: "IMPORT_FAILED", message }] as Prisma.InputJsonValue
        });
      } finally {
        await deleteStagedCsv(jobId);
      }
    })();
  });
}

function scheduleCaseExportJob(
  importExportService: ImportExportService,
  jobId: bigint,
  projectId: bigint,
  userId: bigint,
  type: "cases_csv" | "cases_json" | "cases_xml" | "run_results_csv" | "attachments_json",
  runId?: bigint,
  attachmentFilters?: { caseId?: bigint; runId?: bigint; includeContent?: boolean; includeDownloadUrls?: boolean }
) {
  setImmediate(() => {
    void (async () => {
      try {
        await importExportService.updateExportJob(projectId, jobId, {
          status: "processing",
          summary: { phase: "exporting" } as Prisma.InputJsonValue
        });
        if (type === "cases_csv") {
          await importExportService.exportCasesCsv(projectId, userId, { existingJobId: jobId });
        } else if (type === "cases_json") {
          await importExportService.exportCasesJson(projectId, userId, { existingJobId: jobId });
        } else if (type === "cases_xml") {
          await importExportService.exportCasesXml(projectId, userId, { existingJobId: jobId });
        } else if (type === "run_results_csv" && runId) {
          await importExportService.exportRunResultsCsv(projectId, runId, userId, { existingJobId: jobId });
        } else if (type === "attachments_json") {
          await importExportService.exportAttachmentsJson(projectId, userId, attachmentFilters ?? {}, {
            existingJobId: jobId
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "export failed";
        await importExportService.updateExportJob(projectId, jobId, {
          status: "failed",
          summary: { phase: "failed", message } as Prisma.InputJsonValue
        });
      }
    })();
  });
}

export async function registerImportExportRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  const importExportService = new ImportExportService(deps.prisma);
  const runCaseImport = async (input: {
    projectId: bigint;
    userId: bigint;
    rows: CsvRow[];
    totalRows: number;
    dryRun: boolean;
    atomic: boolean;
    sectionId?: bigint;
    importType: CaseImportFormat;
    columnMapping?: Record<string, string> | null;
  }) => {
    const prisma = importExportService.getPrisma();
    const { issues, normalized } = await validateImportRows(prisma, input.projectId, input.rows, input.sectionId);
    const summary = { totalRows: input.totalRows, validRows: normalized.length, invalidRows: issues.length, imported: 0 };

    if (input.dryRun || (input.atomic && issues.length > 0)) {
      const job = await importExportService.createCaseImportJob({
        projectId: input.projectId,
        userId: input.userId,
        importType: input.importType,
        dryRun: input.dryRun,
        summary: summary as Prisma.InputJsonValue,
        issues: issues as Prisma.InputJsonValue,
        status: issues.length > 0 ? "failed" : "completed"
      });
      await recordActivityEvent(deps.prisma, {
        projectId: input.projectId,
        actorUserId: input.userId,
        entityType: "import",
        entityId: job.id,
        eventType: `import.cases_${input.importType}_validated`,
        title: `Case ${input.importType.toUpperCase()} import validated`,
        body: `valid ${normalized.length} - invalid ${issues.length}`,
        payload: {
          dryRun: input.dryRun,
          atomic: input.atomic,
          totalRows: input.rows.length,
          validRows: normalized.length,
          invalidRows: issues.length
        }
      });
      return {
        status: !input.dryRun && input.atomic && issues.length > 0 ? 400 : 200,
        data: { job, summary, issues, columnMapping: input.columnMapping ?? null }
      };
    }

    const imported = await importExportService.importValidatedCases(
      input.projectId,
      input.userId,
      normalized,
      input.importType
    );
    summary.imported = imported.length;
    const job = await importExportService.createCaseImportJob({
      projectId: input.projectId,
      userId: input.userId,
      importType: input.importType,
      dryRun: false,
      summary: summary as Prisma.InputJsonValue,
      issues: issues as Prisma.InputJsonValue,
      status: issues.length > 0 ? "completed_with_errors" : "completed"
    });
    await recordActivityEvent(deps.prisma, {
      projectId: input.projectId,
      actorUserId: input.userId,
      entityType: "import",
      entityId: job.id,
      eventType: `import.cases_${input.importType}_committed`,
      title: `Case ${input.importType.toUpperCase()} import completed`,
      body: `imported ${imported.length} - invalid ${issues.length}`,
      payload: {
        imported: imported.length,
        invalidRows: issues.length,
        totalRows: input.rows.length
      }
    });
    return { status: 200, data: { job, summary, issues, columnMapping: input.columnMapping ?? null } };
  };

  app.get("/api/projects/:projectId/cases/import/csv/profile", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const customFieldRows = deps.prisma
      ? await deps.prisma.customField.findMany({
          where: { projectId, scope: "case", deletedAt: null, isActive: true },
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          select: { systemName: true, name: true, fieldType: true, isRequired: true }
        })
      : [];
    const customFields = customFieldRows.map((field) => ({ ...field, label: field.name }));
    return reply.send(toJsonSafe(ok(buildCaseCsvImportProfile(customFields))));
  });

  app.post("/api/projects/:projectId/cases/import/csv/suggest-mapping", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = suggestMappingSchema.parse(req.body ?? {});
    const headers = body.headers ?? extractCsvHeaders(body.csv ?? "");
    if (headers.length === 0) {
      throw new AppError("VALIDATION_ERROR", "csv or headers is required", 400);
    }
    const customFieldRows = deps.prisma
      ? await deps.prisma.customField.findMany({
          where: { projectId, scope: "case", deletedAt: null, isActive: true },
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          select: { systemName: true, name: true, isRequired: true }
        })
      : [];
    const customFields = customFieldRows.map((field) => ({ ...field, label: field.name }));
    const mapping = suggestCaseCsvColumnMapping(headers, customFields);
    const mappingIssues = validateCaseCsvColumnMapping(
      mapping,
      customFields.map((field) => ({ systemName: field.systemName, isRequired: field.isRequired }))
    );
    return reply.send(
      toJsonSafe(
        ok({
          headers,
          mapping,
          mappingIssues: mappingIssues.map((issue) => ({ ...issue, row: 1 }))
        })
      )
    );
  });

  app.post("/api/projects/:projectId/cases/import/csv", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = caseImportSchema.parse(req.body ?? {});
    const result = await runCaseCsvImport(importExportService, deps.prisma, {
      projectId,
      userId: user.id,
      body
    });
    return reply.status(result.status).send(toJsonSafe(ok(result.data)));
  });

  app.post("/api/projects/:projectId/cases/import/csv/async", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = caseImportSchema.parse(req.body ?? {});
    const job = await importExportService.createCaseImportJob({
      projectId,
      userId: user.id,
      dryRun: body.dryRun,
      summary: {
        phase: "queued",
        totalBytes: Buffer.byteLength(body.csv, "utf8"),
        recommendedAsync: shouldUseAsyncImport(body.csv)
      } as Prisma.InputJsonValue,
      issues: [] as Prisma.InputJsonValue,
      status: "pending"
    });
    await writeStagedCsv(job.id, body.csv);
    stageCaseCsvImportMeta(job.id, {
      projectId,
      userId: user.id,
      dryRun: body.dryRun,
      atomic: body.atomic,
      sectionId: body.sectionId,
      columnMapping: body.columnMapping
    });
    scheduleCaseCsvImportJob(importExportService, deps.prisma, job.id, projectId);
    return reply.status(202).send(
      toJsonSafe(
        ok({
          job,
          pollUrl: `/api/projects/${projectId.toString()}/import-jobs/${job.id.toString()}`
        })
      )
    );
  });

  app.post("/api/projects/:projectId/cases/import/json", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = structuredCaseImportSchema.parse(req.body ?? {});
    const rows = parseCaseJsonImport(body.content);
    const result = await runCaseImport({
      projectId,
      userId: user.id,
      rows,
      totalRows: rows.length,
      dryRun: body.dryRun,
      atomic: body.atomic,
      sectionId: body.sectionId,
      importType: "json"
    });
    return reply.status(result.status).send(toJsonSafe(ok(result.data)));
  });

  app.post("/api/projects/:projectId/cases/import/xml", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = structuredCaseImportSchema.parse(req.body ?? {});
    const rows = parseCaseXmlImport(body.content);
    const result = await runCaseImport({
      projectId,
      userId: user.id,
      rows,
      totalRows: rows.length,
      dryRun: body.dryRun,
      atomic: body.atomic,
      sectionId: body.sectionId,
      importType: "xml"
    });
    return reply.status(result.status).send(toJsonSafe(ok(result.data)));
  });

  app.get("/api/projects/:projectId/import-jobs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    const { rows, total } = await importExportService.listImportJobs(projectId, page, pageSize);
    return reply.send(toJsonSafe({ data: rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }));
  });

  app.get("/api/projects/:projectId/import-jobs/:jobId", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { jobId } = importJobIdParamSchema.parse(req.params);
    const job = await importExportService.getImportJob(projectId, jobId);
    const issues = Array.isArray(job.errors) ? job.errors : [];
    const summary =
      job.summary && typeof job.summary === "object" && !Array.isArray(job.summary)
        ? (job.summary as Record<string, unknown>)
        : {};
    return reply.send(
      toJsonSafe(
        ok({
          job,
          summary,
          issues,
          resultReady: ["completed", "failed", "completed_with_errors"].includes(job.status)
        })
      )
    );
  });

  app.get("/api/projects/:projectId/export-jobs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const typePrefix =
      typeof (req.query as Record<string, unknown> | undefined)?.typePrefix === "string"
        ? String((req.query as Record<string, unknown>).typePrefix)
        : undefined;
    if (!deps.prisma) return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    const { rows, total } = await importExportService.listExportJobs(projectId, page, pageSize, typePrefix);
    return reply.send(toJsonSafe({ data: rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }));
  });

  app.get("/api/projects/:projectId/export-jobs/:jobId", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { jobId } = exportJobIdParamSchema.parse(req.params);
    const job = await importExportService.getExportJob(projectId, jobId);
    const summary =
      job.summary && typeof job.summary === "object" && !Array.isArray(job.summary)
        ? (job.summary as Record<string, unknown>)
        : {};
    return reply.send(
      toJsonSafe(
        ok({
          job,
          summary,
          downloadUrl:
            job.status === "completed"
              ? `/api/projects/${projectId.toString()}/export-jobs/${jobId.toString()}/download`
              : null
        })
      )
    );
  });

  app.post("/api/projects/:projectId/cases/export/async", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = caseExportAsyncSchema.parse(req.body ?? {});
    const type = body.format === "json" ? "cases_json" : body.format === "xml" ? "cases_xml" : "cases_csv";
    const prisma = importExportService.getPrisma();
    const job = await prisma.exportJob.create({
      data: {
        projectId,
        type,
        status: "pending",
        summary: { phase: "queued", format: body.format } as Prisma.InputJsonValue,
        createdBy: user.id
      }
    });
    scheduleCaseExportJob(importExportService, job.id, projectId, user.id, type);
    return reply.status(202).send(
      toJsonSafe(
        ok({
          job,
          downloadUrl: `/api/projects/${projectId.toString()}/export-jobs/${job.id.toString()}/download`,
          pollUrl: `/api/projects/${projectId.toString()}/export-jobs/${job.id.toString()}`
        })
      )
    );
  });

  const attachmentExportQuerySchema = z.object({
    caseId: z.coerce.bigint().optional(),
    runId: z.coerce.bigint().optional(),
    includeContent: z.coerce.boolean().optional(),
    includeDownloadUrls: z.coerce.boolean().optional()
  });

  const attachmentImportBodySchema = z.object({
    manifest: z.string().trim().min(2),
    dryRun: z.coerce.boolean().optional(),
    replaceExisting: z.coerce.boolean().optional()
  });

  const attachmentExportAsyncBodySchema = z.object({
    caseId: z.coerce.bigint().optional(),
    runId: z.coerce.bigint().optional(),
    includeContent: z.coerce.boolean().optional(),
    includeDownloadUrls: z.coerce.boolean().optional()
  });

  app.get("/api/projects/:projectId/attachments/export", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = attachmentExportQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "attachment export requires prisma mode", 501);
    const json = await importExportService.exportAttachmentsJson(projectId, user.id, {
      caseId: query.caseId,
      runId: query.runId,
      includeContent: query.includeContent,
      includeDownloadUrls: query.includeDownloadUrls ?? true
    });
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header(
      "content-disposition",
      `attachment; filename="project-${projectId.toString()}-attachments.json"`
    );
    return reply.send(json);
  });

  app.post("/api/projects/:projectId/attachments/export/async", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = attachmentExportAsyncBodySchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "attachment export requires prisma mode", 501);
    const prisma = importExportService.getPrisma();
    const job = await prisma.exportJob.create({
      data: {
        projectId,
        type: "attachments_json",
        status: "pending",
        filters: {
          caseId: body.caseId?.toString() ?? null,
          runId: body.runId?.toString() ?? null,
          includeContent: body.includeContent ?? false
        } as Prisma.InputJsonValue,
        summary: { phase: "queued" } as Prisma.InputJsonValue,
        createdBy: user.id
      }
    });
    scheduleCaseExportJob(importExportService, job.id, projectId, user.id, "attachments_json", body.runId, {
      caseId: body.caseId,
      runId: body.runId,
      includeContent: body.includeContent,
      includeDownloadUrls: body.includeDownloadUrls ?? true
    });
    return reply.status(202).send(
      toJsonSafe(
        ok({
          job,
          downloadUrl: `/api/projects/${projectId.toString()}/export-jobs/${job.id.toString()}/download`,
          pollUrl: `/api/projects/${projectId.toString()}/export-jobs/${job.id.toString()}`
        })
      )
    );
  });

  app.post("/api/projects/:projectId/attachments/import", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = attachmentImportBodySchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "attachment import requires prisma mode", 501);
    const result = await importExportService.importAttachmentsFromManifest(
      projectId,
      user.id,
      body.manifest,
      { dryRun: body.dryRun, replaceExisting: body.replaceExisting }
    );
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "import",
      entityId: result.job.id,
      eventType: body.dryRun ? "import.attachments_validated" : "import.attachments_committed",
      title: body.dryRun ? "Attachment import validated" : "Attachments imported",
      body: `imported ${result.summary.imported} of ${result.summary.total}`,
      payload: {
        jobId: result.job.id.toString(),
        dryRun: body.dryRun ?? false,
        summary: result.summary
      }
    });
    return reply.send(toJsonSafe(ok(result)));
  });

  app.post("/api/projects/:projectId/runs/results/export/csv/async", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = runResultsExportAsyncSchema.parse(req.body ?? {});
    const prisma = importExportService.getPrisma();
    const job = await prisma.exportJob.create({
      data: {
        projectId,
        type: "run_results_csv",
        status: "pending",
        filters: { runId: body.runId.toString() } as Prisma.InputJsonValue,
        summary: { phase: "queued" } as Prisma.InputJsonValue,
        createdBy: user.id
      }
    });
    scheduleCaseExportJob(importExportService, job.id, projectId, user.id, "run_results_csv", body.runId);
    return reply.status(202).send(
      toJsonSafe(
        ok({
          job,
          downloadUrl: `/api/projects/${projectId.toString()}/export-jobs/${job.id.toString()}/download`,
          pollUrl: `/api/projects/${projectId.toString()}/export-jobs/${job.id.toString()}`
        })
      )
    );
  });

  app.get("/api/projects/:projectId/reports/export-jobs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    const { rows, total } = await importExportService.listExportJobs(projectId, page, pageSize, "report_");
    return reply.send(toJsonSafe({ data: rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }));
  });

  app.post("/api/projects/:projectId/reports/export", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = reportExportSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "report export requires prisma mode", 501);
    const job = await importExportService.createReportExportJob(projectId, user.id, body);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "report",
      entityId: job.id,
      eventType: "report.export_requested",
      title: "Report export requested",
      body: body.reportType,
      payload: {
        reportType: body.reportType,
        format: body.format,
        jobId: job.id.toString()
      }
    });
    return reply.status(202).send(
      toJsonSafe(
        ok({
          job,
          downloadUrl: `/api/projects/${projectId.toString()}/export-jobs/${job.id.toString()}/download`
        })
      )
    );
  });

  app.get("/api/projects/:projectId/reports/export", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = reportExportSchema.parse(req.query ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "report export requires prisma mode", 501);
    const { exported, job } = await importExportService.buildAdHocReportExport(projectId, user.id, query);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "report",
      entityId: job.id,
      eventType: "report.export_completed",
      title: "Report export completed",
      body: query.reportType,
      payload: {
        reportType: query.reportType,
        format: query.format,
        totalRows: exported.totalRows,
        fileName: exported.fileName,
        jobId: job.id.toString()
      }
    });
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${exported.fileName}"`);
    reply.header("x-export-job-id", job.id.toString());
    return reply.send(exported.csv);
  });

  app.get("/api/projects/:projectId/export-jobs/:jobId/download", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { jobId } = exportJobIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "export job download requires prisma mode", 501);
    const exported = await importExportService.buildExportDownload(projectId, jobId);
    const job = await importExportService.getExportJob(projectId, jobId);
    const entityType = job.type.startsWith("report_") ? "report" : "export";
    const eventType = job.type.startsWith("report_") ? "report.export_downloaded" : "export.job_downloaded";
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType,
      entityId: jobId,
      eventType,
      title: "Export downloaded",
      body: job.type,
      payload: { jobId: jobId.toString(), fileName: exported.fileName, exportType: job.type }
    });
    reply.header("content-type", exported.contentType);
    reply.header("content-disposition", `attachment; filename="${exported.fileName}"`);
    return reply.send(exported.body);
  });

  app.get("/api/projects/:projectId/cases/export/csv", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "case export requires prisma mode", 501);
    const csv = await importExportService.exportCasesCsv(projectId, user.id);
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="project-${projectId.toString()}-cases.csv"`);
    return reply.send(csv);
  });

  app.get("/api/projects/:projectId/cases/export/json", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "case export requires prisma mode", 501);
    const json = await importExportService.exportCasesJson(projectId, user.id);
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="project-${projectId.toString()}-cases.json"`);
    return reply.send(json);
  });

  app.get("/api/projects/:projectId/cases/export/testrail", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "case export requires prisma mode", 501);
    const json = await importExportService.exportCasesTestRailJson(projectId, user.id);
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="project-${projectId.toString()}-cases-testrail.json"`);
    return reply.send(json);
  });

  app.get("/api/projects/:projectId/cases/export/xml", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "case export requires prisma mode", 501);
    const xml = await importExportService.exportCasesXml(projectId, user.id);
    reply.header("content-type", "application/xml; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="project-${projectId.toString()}-cases.xml"`);
    return reply.send(xml);
  });

  app.get("/api/projects/:projectId/runs/:runId/results/export/csv", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "result export requires prisma mode", 501);
    const csv = await importExportService.exportRunResultsCsv(projectId, runId, user.id);
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="run-${runId.toString()}-results.csv"`);
    return reply.send(csv);
  });

  app.get("/api/projects/:projectId/runs/:runId/results/export/testrail", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "result export requires prisma mode", 501);
    const json = await importExportService.exportRunResultsTestRailJson(projectId, runId, user.id);
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="run-${runId.toString()}-results-testrail.json"`);
    return reply.send(json);
  });
}
