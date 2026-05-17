import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";

import type { ProjectsRepository } from "../projects/projects.repository.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { customValuesFromJson, fieldOptions } from "../../domain/customFieldTypes.js";

export const casePropertyDistributionQuerySchema = z.object({
  field: z.string().trim().min(1).optional().default("priority")
});

export type CasePropertyField = {
  key: string;
  label: string;
  type: "system" | "custom";
};

export type CasePropertyDistributionItem = {
  value: string;
  label: string;
  count: number;
  percent: number;
};

export type CasePropertyDistributionReport = {
  selectedField: string;
  fields: CasePropertyField[];
  totalCases: number;
  items: CasePropertyDistributionItem[];
};

export type CaseStatusTopsReport = {
  totalTests: number;
  items: Array<{ status: string; count: number; percent: number }>;
};

type CaseDistributionRow = {
  priority?: string | null;
  caseType?: string | null;
  automationKey?: string | null;
  caseTemplateName?: string | null;
  customValues?: Prisma.JsonValue | Record<string, unknown> | null;
};

type CustomCaseField = {
  systemName: string;
  name: string;
  fieldType: string;
  options?: Prisma.JsonValue | null;
};

const EMPTY_LABEL = "(empty)";

function percent(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function systemFields(): CasePropertyField[] {
  return [
    { key: "priority", label: "Priority", type: "system" },
    { key: "caseType", label: "Type", type: "system" },
    { key: "automation", label: "Automation", type: "system" },
    { key: "template", label: "Template", type: "system" }
  ];
}

function fieldDefinitions(customFields: CustomCaseField[]): CasePropertyField[] {
  return [
    ...systemFields(),
    ...customFields.map((field) => ({
      key: `custom:${field.systemName}`,
      label: field.name,
      type: "custom" as const
    }))
  ];
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY_LABEL;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function valuesForRow(row: CaseDistributionRow, selectedField: string): string[] {
  if (selectedField === "priority") return [normalizeValue(row.priority)];
  if (selectedField === "caseType") return [normalizeValue(row.caseType)];
  if (selectedField === "automation") return [row.automationKey ? "Automated" : "Manual"];
  if (selectedField === "template") return [normalizeValue(row.caseTemplateName)];
  if (selectedField.startsWith("custom:")) {
    const systemName = selectedField.slice("custom:".length);
    const customValues = customValuesFromJson(row.customValues ?? null);
    const value = customValues[systemName];
    if (Array.isArray(value)) return value.length > 0 ? value.map(normalizeValue) : [EMPTY_LABEL];
    return [normalizeValue(value)];
  }
  return [EMPTY_LABEL];
}

function buildDistributionReport(
  rows: CaseDistributionRow[],
  customFields: CustomCaseField[],
  requestedField: string
): CasePropertyDistributionReport {
  const fields = fieldDefinitions(customFields);
  const selectedField = fields.some((field) => field.key === requestedField) ? requestedField : "priority";
  const counts = new Map<string, number>();
  for (const row of rows) {
    const values = [...new Set(valuesForRow(row, selectedField))];
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const items = [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count, percent: percent(count, rows.length) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { selectedField, fields, totalCases: rows.length, items };
}

async function listPrismaCustomCaseFields(prisma: PrismaClient, projectId: bigint): Promise<CustomCaseField[]> {
  const fields = await prisma.customField.findMany({
    where: { projectId, scope: "case", deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: { systemName: true, name: true, fieldType: true, options: true }
  });
  return fields.map((field) => ({
    ...field,
    name: field.name || field.systemName,
    options: fieldOptions(field.options)
  }));
}

export async function buildCasePropertyDistributionReport(
  projectId: bigint,
  deps: { prisma?: PrismaClient; catalog?: ProjectsRepository },
  requestedField: string
): Promise<CasePropertyDistributionReport> {
  if (deps.prisma) {
    const [cases, customFields] = await Promise.all([
      deps.prisma.testCase.findMany({
        where: { projectId, deletedAt: null, archivedAt: null },
        orderBy: { id: "asc" },
        select: {
          priority: true,
          caseType: true,
          automationKey: true,
          customValues: true,
          caseTemplate: { select: { name: true } }
        }
      }),
      listPrismaCustomCaseFields(deps.prisma, projectId)
    ]);
    return buildDistributionReport(
      cases.map((row) => ({
        ...row,
        caseTemplateName: row.caseTemplate?.name ?? null
      })),
      customFields,
      requestedField
    );
  }

  const rows = deps.catalog ? await deps.catalog.listCases({ projectId, state: "active" }) : [];
  return buildDistributionReport(
    rows.map((row) => ({
      priority: row.priority,
      caseType: row.caseType,
      automationKey: row.automationKey,
      caseTemplateName: row.caseTemplateId ? `Template ${row.caseTemplateId.toString()}` : null,
      customValues: row.customValues ?? {}
    })),
    [],
    requestedField
  );
}

export async function buildCaseStatusTopsReport(
  projectId: bigint,
  deps: { prisma?: PrismaClient; repo?: RunsRepository }
): Promise<CaseStatusTopsReport> {
  const counts = new Map<string, number>();
  if (deps.prisma) {
    const rows = await deps.prisma.testInstance.findMany({
      where: { deletedAt: null, run: { projectId, deletedAt: null } },
      select: { status: true }
    });
    for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  } else if (deps.repo) {
    const runs = await deps.repo.listRunsByProject(projectId);
    for (const run of runs) {
      const instances = await deps.repo.listInstancesForRun(run.id);
      for (const instance of instances) counts.set(instance.status, (counts.get(instance.status) ?? 0) + 1);
    }
  }
  const totalTests = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const items = [...counts.entries()]
    .map(([status, count]) => ({ status, count, percent: percent(count, totalTests) }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
  return { totalTests, items };
}
