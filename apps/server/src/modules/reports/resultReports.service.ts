import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";

import { buildResultsComparisonReport } from "../../domain/resultsComparison.js";
import { customValuesFromJson, fieldOptions } from "../../domain/customFieldTypes.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { latestByCreatedAt } from "./reportMetrics.service.js";

export const resultsCaseComparisonQuerySchema = z
  .object({
    runIdA: z.coerce.bigint(),
    runIdB: z.coerce.bigint()
  })
  .refine((query) => query.runIdA !== query.runIdB, {
    message: "runIdA and runIdB must be different"
  });

export const resultsPropertyDistributionQuerySchema = z.object({
  field: z.string().trim().min(1).optional().default("status"),
  runId: z.coerce.bigint().optional()
});

export type ResultPropertyField = {
  key: string;
  label: string;
  type: "system" | "custom";
};

export type ResultPropertyDistributionItem = {
  value: string;
  label: string;
  count: number;
  percent: number;
};

export type ResultPropertyDistributionReport = {
  selectedField: string;
  fields: ResultPropertyField[];
  totalResults: number;
  runId: string | null;
  items: ResultPropertyDistributionItem[];
};

type ResultDistributionRow = {
  status: string;
  source: string;
  version: string | null;
  customValues?: Prisma.JsonValue | Record<string, unknown> | null;
};

type CustomResultField = {
  systemName: string;
  name: string;
  fieldType: string;
  options?: Prisma.JsonValue | null;
};

const EMPTY_LABEL = "(empty)";

function percent(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function systemResultFields(): ResultPropertyField[] {
  return [
    { key: "status", label: "Status", type: "system" },
    { key: "source", label: "Source", type: "system" },
    { key: "version", label: "Version", type: "system" }
  ];
}

function resultFieldDefinitions(customFields: CustomResultField[]): ResultPropertyField[] {
  return [
    ...systemResultFields(),
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

function valuesForResultRow(row: ResultDistributionRow, selectedField: string): string[] {
  if (selectedField === "status") return [normalizeValue(row.status)];
  if (selectedField === "source") return [normalizeValue(row.source)];
  if (selectedField === "version") return [normalizeValue(row.version)];
  if (selectedField.startsWith("custom:")) {
    const systemName = selectedField.slice("custom:".length);
    const customValues = customValuesFromJson(row.customValues ?? null);
    const value = customValues[systemName];
    if (Array.isArray(value)) return value.length > 0 ? value.map(normalizeValue) : [EMPTY_LABEL];
    return [normalizeValue(value)];
  }
  return [EMPTY_LABEL];
}

function buildResultDistributionReport(
  rows: ResultDistributionRow[],
  customFields: CustomResultField[],
  requestedField: string,
  runId: string | null
): ResultPropertyDistributionReport {
  const fields = resultFieldDefinitions(customFields);
  const selectedField = fields.some((field) => field.key === requestedField) ? requestedField : "status";
  const counts = new Map<string, number>();
  for (const row of rows) {
    const values = [...new Set(valuesForResultRow(row, selectedField))];
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const items = [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count, percent: percent(count, rows.length) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { selectedField, fields, totalResults: rows.length, runId, items };
}

async function listPrismaCustomResultFields(prisma: PrismaClient, projectId: bigint): Promise<CustomResultField[]> {
  const fields = await prisma.customField.findMany({
    where: { projectId, scope: "result", deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: { systemName: true, name: true, fieldType: true, options: true }
  });
  return fields.map((field) => ({
    ...field,
    name: field.name || field.systemName,
    options: fieldOptions(field.options)
  }));
}

async function loadComparisonCasesFromPrisma(
  prisma: PrismaClient,
  projectId: bigint,
  runId: bigint
) {
  const run = await prisma.testRun.findFirst({
    where: { id: runId, projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      instances: {
        where: { deletedAt: null },
        select: { id: true, caseId: true, titleSnapshot: true, status: true }
      }
    }
  });
  if (!run) return null;
  return {
    runId: run.id.toString(),
    name: run.name,
    cases: run.instances.map((instance) => ({
      caseId: instance.caseId.toString(),
      title: instance.titleSnapshot,
      status: instance.status,
      testId: instance.id.toString()
    }))
  };
}

async function loadComparisonCasesFromMemory(repo: RunsRepository, projectId: bigint, runId: bigint) {
  const runs = await repo.listRunsByProject(projectId);
  const run = runs.find((row) => row.id === runId);
  if (!run) return null;
  const instances = await repo.listInstancesForRun(run.id);
  return {
    runId: run.id.toString(),
    name: run.name,
    cases: instances.map((instance) => ({
      caseId: instance.caseId.toString(),
      title: instance.titleSnapshot,
      status: instance.status,
      testId: instance.id.toString()
    }))
  };
}

export async function buildResultsCaseComparisonReport(
  projectId: bigint,
  deps: { prisma?: PrismaClient; repo?: RunsRepository },
  query: z.infer<typeof resultsCaseComparisonQuerySchema>
) {
  const loadRun = deps.prisma
    ? (runId: bigint) => loadComparisonCasesFromPrisma(deps.prisma!, projectId, runId)
    : deps.repo
      ? (runId: bigint) => loadComparisonCasesFromMemory(deps.repo!, projectId, runId)
      : async () => null;

  const [runA, runB] = await Promise.all([loadRun(query.runIdA), loadRun(query.runIdB)]);
  return buildResultsComparisonReport(
    { runId: query.runIdA.toString(), name: runA?.name ?? `Run ${query.runIdA.toString()}` },
    { runId: query.runIdB.toString(), name: runB?.name ?? `Run ${query.runIdB.toString()}` },
    runA?.cases ?? [],
    runB?.cases ?? []
  );
}

async function loadLatestResultRowsFromPrisma(
  prisma: PrismaClient,
  projectId: bigint,
  runId?: bigint
): Promise<ResultDistributionRow[]> {
  const instances = await prisma.testInstance.findMany({
    where: {
      deletedAt: null,
      run: {
        projectId,
        deletedAt: null,
        ...(runId ? { id: runId } : {})
      }
    },
    include: {
      results: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, status: true, source: true, version: true, customValues: true }
      }
    }
  });
  const rows: ResultDistributionRow[] = [];
  for (const instance of instances) {
    const latest = latestByCreatedAt(instance.results);
    if (!latest) {
      rows.push({ status: instance.status, source: "manual", version: null, customValues: null });
      continue;
    }
    rows.push({
      status: latest.status,
      source: latest.source,
      version: latest.version,
      customValues: latest.customValues
    });
  }
  return rows;
}

async function loadLatestResultRowsFromMemory(
  repo: RunsRepository,
  projectId: bigint,
  runId?: bigint
): Promise<ResultDistributionRow[]> {
  const runs = await repo.listRunsByProject(projectId);
  const targetRuns = runId ? runs.filter((run) => run.id === runId) : runs;
  const rows: ResultDistributionRow[] = [];
  for (const run of targetRuns) {
    const instances = await repo.listInstancesForRun(run.id);
    for (const instance of instances) {
      const results = await repo.listResultsForTestInstance(instance.id);
      const latest = latestByCreatedAt(results);
      if (!latest) {
        rows.push({ status: instance.status, source: "manual", version: null, customValues: null });
        continue;
      }
      rows.push({
        status: latest.status,
        source: latest.source,
        version: latest.version ?? null,
        customValues: latest.customValues ?? null
      });
    }
  }
  return rows;
}

export async function buildResultsPropertyDistributionReport(
  projectId: bigint,
  deps: { prisma?: PrismaClient; repo?: RunsRepository },
  query: z.infer<typeof resultsPropertyDistributionQuerySchema>
): Promise<ResultPropertyDistributionReport> {
  const runId = query.runId?.toString() ?? null;
  if (deps.prisma) {
    const [rows, customFields] = await Promise.all([
      loadLatestResultRowsFromPrisma(deps.prisma, projectId, query.runId),
      listPrismaCustomResultFields(deps.prisma, projectId)
    ]);
    return buildResultDistributionReport(rows, customFields, query.field ?? "status", runId);
  }
  if (deps.repo) {
    const rows = await loadLatestResultRowsFromMemory(deps.repo, projectId, query.runId);
    return buildResultDistributionReport(rows, [], query.field ?? "status", runId);
  }
  return buildResultDistributionReport([], [], query.field ?? "status", runId);
}
