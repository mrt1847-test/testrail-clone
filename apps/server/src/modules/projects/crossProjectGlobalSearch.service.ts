import type { PrismaClient } from "@prisma/client";

import {
  caseSearchWhere,
  milestoneSearchWhere,
  parseGlobalSearchQuery,
  planSearchWhere,
  runSearchWhere,
  type GlobalSearchEntityType,
  type ParsedGlobalSearchQuery,
  type ProjectSearchScope
} from "../../domain/projectGlobalSearch.js";

function projectIdFilter(scope: ProjectSearchScope) {
  return typeof scope === "bigint" ? { projectId: scope } : { projectId: { in: scope.in } };
}

export type CrossProjectGlobalSearchHit = {
  entityType: GlobalSearchEntityType;
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  subtitle: string | null;
  path: string;
};

export type CrossProjectGlobalSearchResponse = {
  query: string;
  items: CrossProjectGlobalSearchHit[];
};

const MAX_PROJECTS = 50;

function hit(
  entityType: GlobalSearchEntityType,
  projectId: bigint,
  projectName: string,
  id: bigint,
  title: string,
  path: string,
  subtitle: string | null = null
): CrossProjectGlobalSearchHit {
  return {
    entityType,
    id: id.toString(),
    projectId: projectId.toString(),
    projectName,
    title,
    subtitle,
    path
  };
}

async function loadAccessibleProjects(prisma: PrismaClient, userId: bigint) {
  const rows = await prisma.projectMember.findMany({
    where: {
      userId,
      deletedAt: null,
      project: { deletedAt: null, isActive: true }
    },
    orderBy: { project: { name: "asc" } },
    take: MAX_PROJECTS,
    select: {
      project: { select: { id: true, name: true } }
    }
  });
  const projects = rows.map((row) => row.project);
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  return { projectIds: projects.map((p) => p.id), nameById };
}

async function searchCasesCross(
  prisma: PrismaClient,
  scope: { in: bigint[] },
  nameById: Map<bigint, string>,
  parsed: ParsedGlobalSearchQuery,
  take: number
) {
  const rows = await prisma.testCase.findMany({
    where: caseSearchWhere(scope, parsed),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      title: true,
      projectId: true,
      section: { select: { name: true } }
    }
  });
  return rows.map((row) =>
    hit(
      "case",
      row.projectId,
      nameById.get(row.projectId) ?? "Project",
      row.id,
      row.title,
      `cases/${row.id.toString()}`,
      row.section?.name ? `Section: ${row.section.name}` : null
    )
  );
}

async function searchRunsCross(
  prisma: PrismaClient,
  scope: { in: bigint[] },
  nameById: Map<bigint, string>,
  parsed: ParsedGlobalSearchQuery,
  take: number
) {
  const rows = await prisma.testRun.findMany({
    where: runSearchWhere(scope, parsed),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, name: true, status: true, projectId: true }
  });
  return rows.map((row) =>
    hit(
      "run",
      row.projectId,
      nameById.get(row.projectId) ?? "Project",
      row.id,
      row.name,
      `runs/${row.id.toString()}`,
      `Status: ${row.status}`
    )
  );
}

async function searchMilestonesCross(
  prisma: PrismaClient,
  scope: { in: bigint[] },
  nameById: Map<bigint, string>,
  parsed: ParsedGlobalSearchQuery,
  take: number
) {
  const rows = await prisma.milestone.findMany({
    where: milestoneSearchWhere(scope, parsed),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, name: true, isCompleted: true, projectId: true }
  });
  return rows.map((row) =>
    hit(
      "milestone",
      row.projectId,
      nameById.get(row.projectId) ?? "Project",
      row.id,
      row.name,
      `milestones/${row.id.toString()}`,
      row.isCompleted ? "Completed" : "Open"
    )
  );
}

async function searchPlansCross(
  prisma: PrismaClient,
  scope: { in: bigint[] },
  nameById: Map<bigint, string>,
  parsed: ParsedGlobalSearchQuery,
  take: number
) {
  const rows = await prisma.testPlan.findMany({
    where: planSearchWhere(scope, parsed),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: { id: true, name: true, status: true, projectId: true }
  });
  return rows.map((row) =>
    hit(
      "plan",
      row.projectId,
      nameById.get(row.projectId) ?? "Project",
      row.id,
      row.name,
      `plans/${row.id.toString()}`,
      `Status: ${row.status}`
    )
  );
}

async function searchDefectsCross(
  prisma: PrismaClient,
  scope: { in: bigint[] },
  nameById: Map<bigint, string>,
  parsed: ParsedGlobalSearchQuery,
  take: number
) {
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
            ...projectIdFilter(scope),
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
              run: { select: { id: true, name: true, projectId: true } }
            }
          }
        }
      }
    }
  });

  const seen = new Set<string>();
  const hits: CrossProjectGlobalSearchHit[] = [];
  for (const row of rows) {
    if (seen.has(row.defectKey)) continue;
    seen.add(row.defectKey);
    const run = row.result.instance.run;
    hits.push(
      hit(
        "defect",
        run.projectId,
        nameById.get(run.projectId) ?? "Project",
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

export async function searchCrossProjectGlobal(
  prisma: PrismaClient | undefined,
  input: { userId: bigint; query: string; limitPerType?: number }
): Promise<CrossProjectGlobalSearchResponse> {
  const parsed = parseGlobalSearchQuery(input.query);
  if (!parsed) return { query: input.query.trim(), items: [] };
  if (!prisma) return { query: parsed.raw, items: [] };

  const { projectIds, nameById } = await loadAccessibleProjects(prisma, input.userId);
  if (projectIds.length === 0) return { query: parsed.raw, items: [] };

  const scope = { in: projectIds };
  const take = Math.min(Math.max(input.limitPerType ?? 8, 1), 20);
  const searchDefectsEnabled =
    parsed.text.length > 0 ||
    (parsed.runId != null && parsed.caseId == null && parsed.milestoneId == null && parsed.planId == null) ||
    (parsed.caseId != null && parsed.runId == null && parsed.milestoneId == null && parsed.planId == null);

  const [cases, runs, milestones, plans, defects] = await Promise.all([
    searchCasesCross(prisma, scope, nameById, parsed, take),
    searchRunsCross(prisma, scope, nameById, parsed, take),
    searchMilestonesCross(prisma, scope, nameById, parsed, take),
    searchPlansCross(prisma, scope, nameById, parsed, take),
    searchDefectsEnabled ? searchDefectsCross(prisma, scope, nameById, parsed, take) : Promise.resolve([])
  ]);

  const items = [...cases, ...runs, ...milestones, ...plans, ...defects];
  items.sort((a, b) => {
    const byProject = a.projectName.localeCompare(b.projectName);
    if (byProject !== 0) return byProject;
    const typeOrder: GlobalSearchEntityType[] = ["case", "run", "milestone", "plan", "defect"];
    return typeOrder.indexOf(a.entityType) - typeOrder.indexOf(b.entityType);
  });

  return { query: parsed.raw, items };
}
