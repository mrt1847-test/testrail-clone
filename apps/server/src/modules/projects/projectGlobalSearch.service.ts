import type { PrismaClient } from "@prisma/client";

import {
  caseSearchWhere,
  milestoneSearchWhere,
  parseGlobalSearchQuery,
  planSearchWhere,
  runSearchWhere,
  type GlobalSearchEntityType,
  type ParsedGlobalSearchQuery
} from "../../domain/projectGlobalSearch.js";

export type GlobalSearchHit = {
  entityType: GlobalSearchEntityType;
  id: string;
  title: string;
  subtitle: string | null;
  path: string;
};

export type GlobalSearchResponse = {
  query: string;
  items: GlobalSearchHit[];
};

function hit(
  entityType: GlobalSearchEntityType,
  id: bigint,
  title: string,
  path: string,
  subtitle: string | null = null
): GlobalSearchHit {
  return {
    entityType,
    id: id.toString(),
    title,
    subtitle,
    path
  };
}

async function searchCases(prisma: PrismaClient, projectId: bigint, parsed: ParsedGlobalSearchQuery, take: number) {
  const rows = await prisma.testCase.findMany({
    where: caseSearchWhere(projectId, parsed),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      title: true,
      section: { select: { name: true } }
    }
  });
  return rows.map((row) =>
    hit("case", row.id, row.title, `cases/${row.id.toString()}`, row.section?.name ? `Section: ${row.section.name}` : null)
  );
}

async function searchRuns(prisma: PrismaClient, projectId: bigint, parsed: ParsedGlobalSearchQuery, take: number) {
  const rows = await prisma.testRun.findMany({
    where: runSearchWhere(projectId, parsed),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, name: true, status: true }
  });
  return rows.map((row) => hit("run", row.id, row.name, `runs/${row.id.toString()}`, `Status: ${row.status}`));
}

async function searchMilestones(prisma: PrismaClient, projectId: bigint, parsed: ParsedGlobalSearchQuery, take: number) {
  const rows = await prisma.milestone.findMany({
    where: milestoneSearchWhere(projectId, parsed),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, name: true, isCompleted: true }
  });
  return rows.map((row) =>
    hit("milestone", row.id, row.name, `milestones/${row.id.toString()}`, row.isCompleted ? "Completed" : "Open")
  );
}

async function searchPlans(prisma: PrismaClient, projectId: bigint, parsed: ParsedGlobalSearchQuery, take: number) {
  const rows = await prisma.testPlan.findMany({
    where: planSearchWhere(projectId, parsed),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, name: true, status: true }
  });
  return rows.map((row) => hit("plan", row.id, row.name, `plans/${row.id.toString()}`, `Status: ${row.status}`));
}

async function searchDefects(prisma: PrismaClient, projectId: bigint, parsed: ParsedGlobalSearchQuery, take: number) {
  const needle = parsed.text || parsed.raw;
  const rows = await prisma.resultDefectLink.findMany({
    where: {
      deletedAt: null,
      ...(parsed.caseId == null && parsed.runId == null
        ? { defectKey: { contains: needle, mode: "insensitive" } }
        : {}),
      result: {
        instance: {
          run: {
            projectId,
            deletedAt: null,
            ...(parsed.runId != null ? { id: parsed.runId } : {})
          },
          ...(parsed.caseId != null ? { caseId: parsed.caseId } : {})
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: take * 3,
    select: {
      id: true,
      defectKey: true,
      result: {
        select: {
          instance: {
            select: {
              id: true,
              titleSnapshot: true,
              run: { select: { id: true, name: true } }
            }
          }
        }
      }
    }
  });

  const seen = new Set<string>();
  const hits: GlobalSearchHit[] = [];
  for (const row of rows) {
    if (seen.has(row.defectKey)) continue;
    seen.add(row.defectKey);
    const run = row.result.instance.run;
    hits.push(
      hit(
        "defect",
        row.id,
        row.defectKey,
        `runs/${run.id.toString()}`,
        `${row.result.instance.titleSnapshot} · ${run.name}`
      )
    );
    if (hits.length >= take) break;
  }
  return hits;
}

export async function searchProjectGlobal(
  prisma: PrismaClient | undefined,
  input: { projectId: bigint; query: string; limitPerType?: number }
): Promise<GlobalSearchResponse> {
  const parsed = parseGlobalSearchQuery(input.query);
  if (!parsed) return { query: input.query.trim(), items: [] };
  if (!prisma) return { query: parsed.raw, items: [] };

  const take = Math.min(Math.max(input.limitPerType ?? 8, 1), 20);
  const searchDefectsEnabled =
    parsed.text.length > 0 ||
    (parsed.runId != null && parsed.caseId == null && parsed.milestoneId == null && parsed.planId == null) ||
    (parsed.caseId != null && parsed.runId == null && parsed.milestoneId == null && parsed.planId == null);

  const [cases, runs, milestones, plans, defects] = await Promise.all([
    searchCases(prisma, input.projectId, parsed, take),
    searchRuns(prisma, input.projectId, parsed, take),
    searchMilestones(prisma, input.projectId, parsed, take),
    searchPlans(prisma, input.projectId, parsed, take),
    searchDefectsEnabled ? searchDefects(prisma, input.projectId, parsed, take) : Promise.resolve([])
  ]);

  return {
    query: parsed.raw,
    items: [...cases, ...runs, ...milestones, ...plans, ...defects]
  };
}
