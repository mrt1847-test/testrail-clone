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
import { runIdParamSchema } from "../runs/runs.schema.js";
import { recordActivityEvent } from "../activity/activity.service.js";

type CsvRow = Record<string, string>;
type ImportIssue = { row: number; field?: string; code: string; message: string };
type ScalarCustomValue = string | number | boolean | null;
type CustomFieldDefinition = {
  systemName: string;
  fieldType: string;
  options: Prisma.JsonValue | null;
  isRequired: boolean;
};

const caseImportSchema = z.object({
  csv: z.string().min(1),
  dryRun: z.boolean().optional().default(true),
  atomic: z.boolean().optional().default(true),
  sectionId: z.coerce.bigint().optional()
});

const reportExportSchema = z.object({
  reportType: z.enum(["run_summary", "results_explorer", "traceability", "coverage_gap", "defect_coverage"]).default("results_explorer"),
  format: z.enum(["csv"]).default("csv"),
  runId: z.coerce.bigint().optional(),
  caseId: z.coerce.bigint().optional(),
  testId: z.coerce.bigint().optional(),
  status: z.enum(["passed", "failed", "blocked", "retest", "untested"]).optional(),
  source: z.enum(["manual", "automation", "api"]).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  q: z.string().trim().min(1).optional(),
  maxRows: z.coerce.number().int().min(1).max(50000).default(10000)
});

const exportJobIdParamSchema = z.object({
  jobId: z.coerce.bigint()
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

function normalizeReportFilters(input: z.infer<typeof reportExportSchema>) {
  return {
    reportType: input.reportType,
    format: input.format,
    ...(input.runId ? { runId: input.runId.toString() } : {}),
    ...(input.caseId ? { caseId: input.caseId.toString() } : {}),
    ...(input.testId ? { testId: input.testId.toString() } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.createdFrom ? { createdFrom: input.createdFrom } : {}),
    ...(input.createdTo ? { createdTo: input.createdTo } : {}),
    ...(input.q ? { q: input.q } : {}),
    maxRows: input.maxRows
  };
}

function parseReportFilters(value: Prisma.JsonValue | null | undefined) {
  const raw = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  return reportExportSchema.parse(raw);
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
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      take: input.maxRows,
      include: { instances: { where: { deletedAt: null }, select: { status: true } } }
    });
    const rows = runs.map((run) => {
      const metrics = toRunSummaryMetrics(run.instances.map((item) => item.status));
      return {
        run_id: run.id,
        name: run.name,
        status: run.status,
        total: metrics.total,
        passed: metrics.passed,
        failed: metrics.failed,
        progress: metrics.progress
      };
    });
    return {
      fileName: `project-${projectId.toString()}-run-summary.csv`,
      csv: toCsv(["run_id", "name", "status", "total", "passed", "failed", "progress"], rows),
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
      include: { instance: { include: { run: true } }, defectLinks: { where: { deletedAt: null } } }
    });
    return {
      fileName: `project-${projectId.toString()}-results-explorer.csv`,
      csv: toCsv(
        ["result_id", "run_id", "run_name", "test_id", "case_id", "title", "status", "source", "comment", "defects", ...customHeaders, "created_at"],
        rows.map((row) => ({
          result_id: row.id,
          run_id: row.instance.runId,
          run_name: row.instance.run.name,
          test_id: row.testInstanceId,
          case_id: row.instance.caseId,
          title: row.instance.titleSnapshot,
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
      priority: firstValue(row, ["priority", "Priority"]),
      caseType: firstValue(row, ["type", "case_type", "caseType", "Type"]),
      refs: firstValue(row, ["refs", "references", "References"]),
      labels: splitList(firstValue(row, ["labels", "Labels"])),
      automationKey: firstValue(row, ["automation_key", "automationKey"]),
      externalId: firstValue(row, ["external_id", "externalId"]),
      customValues,
      steps
    });
  });

  return { issues, normalized };
}

class ImportExportService {
  constructor(private readonly prisma?: PrismaClient) {}

  getPrisma() {
    if (!this.prisma) throw new AppError("NOT_IMPLEMENTED", "feature requires prisma mode", 501);
    return this.prisma;
  }

  async createCaseImportJob(input: {
    projectId: bigint;
    userId: bigint;
    dryRun: boolean;
    summary: Prisma.InputJsonValue;
    issues: Prisma.InputJsonValue;
    status: "failed" | "completed" | "completed_with_errors";
  }) {
    const prisma = this.getPrisma();
    return prisma.importJob.create({
      data: {
        projectId: input.projectId,
        type: "cases_csv",
        status: input.status,
        dryRun: input.dryRun,
        summary: input.summary,
        errors: input.issues,
        createdBy: input.userId
      }
    });
  }

  async importValidatedCases(projectId: bigint, userId: bigint, normalized: Array<{
    sectionId: bigint;
    title: string;
    preconditions?: string;
    priority?: string;
    caseType?: string;
    refs?: string;
    labels: string[];
    automationKey?: string;
    externalId?: string;
    customValues: Record<string, ScalarCustomValue>;
    steps: Array<{ content: string; expectedResult?: string | null }>;
  }>) {
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
            changeReason: "csv_import"
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

  async listExportJobs(projectId: bigint, page: number, pageSize: number) {
    const prisma = this.getPrisma();
    const where = { projectId };
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

  async exportCasesCsv(projectId: bigint, userId: bigint) {
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
    const headers = [
      "id",
      "section_id",
      "title",
      "preconditions",
      "priority",
      "type",
      "refs",
      "labels",
      "automation_key",
      "external_id",
      ...customFields.map((field) => customColumnName(field.systemName)),
      "steps"
    ];
    const csv = toCsv(
      headers,
      rows.map((row) => ({
        id: row.id,
        section_id: row.sectionId,
        title: row.title,
        preconditions: row.preconditions,
        priority: row.priority,
        type: row.caseType,
        refs: row.refs,
        labels: row.labels.join("|"),
        automation_key: row.automationKey,
        external_id: row.externalId,
        ...Object.fromEntries(
          customFields.map((field) => {
            const value =
              row.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues)
                ? (row.customValues as Record<string, unknown>)[field.systemName]
                : undefined;
            return [customColumnName(field.systemName), value ?? ""];
          })
        ),
        steps: row.steps.map((step) => `${step.content}${step.expectedResult ? `=>${step.expectedResult}` : ""}`).join("|")
      }))
    );
    await prisma.exportJob.create({
      data: {
        projectId,
        type: "cases_csv",
        status: "completed",
        summary: { totalRows: rows.length } as Prisma.InputJsonValue,
        createdBy: userId
      }
    });
    return csv;
  }

  async exportRunResultsCsv(projectId: bigint, runId: bigint, userId: bigint) {
    const prisma = this.getPrisma();
    const run = await prisma.testRun.findFirst({ where: { id: runId, projectId, deletedAt: null } });
    if (!run) throw new AppError("NOT_FOUND", `run ${runId.toString()} not found`, 404);
    const rows = await prisma.testResult.findMany({
      where: { instance: { runId } },
      orderBy: { createdAt: "desc" },
      include: { instance: true, defectLinks: { where: { deletedAt: null } } }
    });
    const customFields = await prisma.customField.findMany({
      where: { projectId, scope: "result", deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { systemName: true }
    });
    const customHeaders = customFields.map((field) => customColumnName(field.systemName));
    const csv = toCsv(
      ["result_id", "test_id", "case_id", "status", "comment", "elapsed", "version", "source", "defects", ...customHeaders, "created_at"],
      rows.map((row) => ({
        result_id: row.id,
        test_id: row.testInstanceId,
        case_id: row.instance.caseId,
        status: row.status,
        comment: row.comment,
        elapsed: row.elapsed,
        version: row.version,
        source: row.source,
        defects: [...row.defects, ...row.defectLinks.map((link) => link.defectKey)].join("|"),
        ...Object.fromEntries(
          customFields.map((field) => [customColumnName(field.systemName), customValueFromJson(row.customValues, field.systemName)])
        ),
        created_at: row.createdAt.toISOString()
      }))
    );
    await prisma.exportJob.create({
      data: {
        projectId,
        type: "run_results_csv",
        filters: { runId: runId.toString() } as Prisma.InputJsonValue,
        status: "completed",
        summary: { totalRows: rows.length } as Prisma.InputJsonValue,
        createdBy: userId
      }
    });
    return csv;
  }
}

export async function registerImportExportRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  const importExportService = new ImportExportService(deps.prisma);
  app.post("/api/projects/:projectId/cases/import/csv", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = caseImportSchema.parse(req.body ?? {});
    const prisma = importExportService.getPrisma();

    const rows = parseCsv(body.csv);
    const { issues, normalized } = await validateImportRows(prisma, projectId, rows, body.sectionId);
    const summary = { totalRows: rows.length, validRows: normalized.length, invalidRows: issues.length, imported: 0 };

    if (body.dryRun || (body.atomic && issues.length > 0)) {
      const job = await importExportService.createCaseImportJob({
        projectId,
        userId: user.id,
        dryRun: body.dryRun,
        summary: summary as Prisma.InputJsonValue,
        issues: issues as Prisma.InputJsonValue,
        status: issues.length > 0 ? "failed" : "completed"
      });
      const status = !body.dryRun && body.atomic && issues.length > 0 ? 400 : 200;
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
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
      return reply.status(status).send(toJsonSafe(ok({ job, summary, issues })));
    }

    const imported = await importExportService.importValidatedCases(projectId, user.id, normalized);

    summary.imported = imported.length;
    const job = await importExportService.createCaseImportJob({
      projectId,
      userId: user.id,
      dryRun: false,
      summary: summary as Prisma.InputJsonValue,
      issues: issues as Prisma.InputJsonValue,
      status: issues.length > 0 ? "completed_with_errors" : "completed"
    });
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
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
    return reply.send(toJsonSafe(ok({ job, summary, issues })));
  });

  app.get("/api/projects/:projectId/import-jobs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    const { rows, total } = await importExportService.listImportJobs(projectId, page, pageSize);
    return reply.send(toJsonSafe({ data: rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }));
  });

  app.get("/api/projects/:projectId/export-jobs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    const { rows, total } = await importExportService.listExportJobs(projectId, page, pageSize);
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
    const exported = await importExportService.buildReportExportFromJob(projectId, jobId);
    const reportType = String(exported.fileName).includes("run-summary")
      ? "run_summary"
      : String(exported.fileName).includes("traceability")
        ? "traceability"
        : String(exported.fileName).includes("coverage-gap")
          ? "coverage_gap"
          : String(exported.fileName).includes("defect-coverage")
            ? "defect_coverage"
            : "results_explorer";
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "report",
      entityId: jobId,
      eventType: "report.export_downloaded",
      title: "Report export downloaded",
      body: reportType,
      payload: { reportType, jobId: jobId.toString(), fileName: exported.fileName, totalRows: exported.totalRows }
    });
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${exported.fileName}"`);
    return reply.send(exported.csv);
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
}
