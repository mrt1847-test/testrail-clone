import type { PrismaClient } from "@prisma/client";

import { buildRunProgressMetrics, type RunProgressMetrics } from "../../domain/runProgress.js";
import { listMemoryPlans } from "../plans/plans.routes.js";
import type { RunsRepository } from "./runs.repository.js";
import { loadRunProgressMetrics } from "./runProgressMetrics.js";

export type RunPlanOverviewItemType = "run" | "plan";

export type RunPlanOverviewItem = {
  id: string;
  type: RunPlanOverviewItemType;
  name: string;
  createdAt: string;
  createdBy: string | null;
  statusCounts: Record<string, number>;
  percentPassed: number;
  percentComplete: number;
  totalTests: number;
  editPath: string;
  viewPath: string;
};

export type CompletedOverviewItem = {
  id: string;
  type: RunPlanOverviewItemType;
  name: string;
  percentPassed: number;
  closedAt: string;
  viewPath: string;
};

export type RunsOverviewResponse = {
  open: { total: number; items: RunPlanOverviewItem[] };
  completed: { total: number; groups: Array<{ date: string; items: CompletedOverviewItem[] }> };
  counts: { open: number; completed: number };
};

type OverviewFilters = {
  mine?: boolean;
  userId?: bigint;
  milestoneId?: string | null;
  orderBy?: "date" | "name";
  openLimit?: number;
  completedLimit?: number;
};

function metricsToItemFields(metrics: RunProgressMetrics) {
  const total = metrics.total;
  const percentPassed = total === 0 ? 0 : Math.round((metrics.passed / total) * 100);
  return {
    statusCounts: metrics.counts,
    percentPassed,
    percentComplete: metrics.progressPercent,
    totalTests: total
  };
}

function itemFromMetrics(
  input: {
    id: bigint;
    type: RunPlanOverviewItemType;
    name: string;
    createdAt: Date;
    createdBy: bigint | null;
  },
  metrics: RunProgressMetrics
): RunPlanOverviewItem {
  const id = input.id.toString();
  const base = metricsToItemFields(metrics);
  return {
    id,
    type: input.type,
    name: input.name,
    createdAt: input.createdAt.toISOString(),
    createdBy: input.createdBy?.toString() ?? null,
    ...base,
    editPath: input.type === "plan" ? `plans/${id}` : `runs/${id}`,
    viewPath: input.type === "plan" ? `plans/${id}` : `runs/${id}`
  };
}

function sortOpenItems(items: RunPlanOverviewItem[], orderBy: "date" | "name") {
  const copy = [...items];
  if (orderBy === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }
  copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return copy;
}

function groupCompletedByDate(items: CompletedOverviewItem[]) {
  const byDate = new Map<string, CompletedOverviewItem[]>();
  for (const item of items) {
    const day = item.closedAt.slice(0, 10);
    const bucket = byDate.get(day) ?? [];
    bucket.push(item);
    byDate.set(day, bucket);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, groupItems]) => ({
      date,
      items: groupItems.sort((a, b) => a.name.localeCompare(b.name))
    }));
}

function formatClosedDay(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(iso)
  );
}

export { formatClosedDay };

async function buildRunsOverviewPrisma(
  prisma: PrismaClient,
  projectId: bigint,
  filters: OverviewFilters
): Promise<RunsOverviewResponse> {
  const milestoneId =
    filters.milestoneId && filters.milestoneId !== "all" ? BigInt(filters.milestoneId) : null;

  const runWhereBase = {
    projectId,
    deletedAt: null as null,
    ...(milestoneId != null ? { milestoneId } : {}),
    ...(filters.mine && filters.userId != null ? { assignedTo: filters.userId } : {})
  };

  const [openPlans, openRuns, closedPlans, closedRuns] = await Promise.all([
    prisma.testPlan.findMany({
      where: {
        projectId,
        deletedAt: null,
        status: "open",
        ...(milestoneId != null ? { milestoneId } : {}),
        ...(filters.mine && filters.userId != null ? { assignedTo: filters.userId } : {})
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: true,
        runs: {
          where: { deletedAt: null },
          select: {
            instances: { where: { deletedAt: null }, select: { status: true } }
          }
        }
      }
    }),
    prisma.testRun.findMany({
      where: { ...runWhereBase, status: "open", planId: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: true,
        instances: { where: { deletedAt: null }, select: { status: true } }
      }
    }),
    prisma.testPlan.findMany({
      where: {
        projectId,
        deletedAt: null,
        status: "closed",
        ...(milestoneId != null ? { milestoneId } : {})
      },
      orderBy: { updatedAt: "desc" },
      take: filters.completedLimit ?? 40,
      select: {
        id: true,
        name: true,
        updatedAt: true,
        runs: {
          where: { deletedAt: null },
          select: {
            instances: { where: { deletedAt: null }, select: { status: true } }
          }
        }
      }
    }),
    prisma.testRun.findMany({
      where: { ...runWhereBase, status: "closed", planId: null },
      orderBy: { closedAt: "desc" },
      take: filters.completedLimit ?? 40,
      select: {
        id: true,
        name: true,
        closedAt: true,
        createdAt: true,
        instances: { where: { deletedAt: null }, select: { status: true } }
      }
    })
  ]);

  const openItems: RunPlanOverviewItem[] = [];

  for (const plan of openPlans) {
    const statuses = plan.runs.flatMap((run) => run.instances.map((i) => i.status));
    openItems.push(
      itemFromMetrics(
        {
          id: plan.id,
          type: "plan",
          name: plan.name,
          createdAt: plan.createdAt,
          createdBy: plan.createdBy
        },
        buildRunProgressMetrics(statuses)
      )
    );
  }

  for (const run of openRuns) {
    openItems.push(
      itemFromMetrics(
        {
          id: run.id,
          type: "run",
          name: run.name,
          createdAt: run.createdAt,
          createdBy: run.createdBy
        },
        buildRunProgressMetrics(run.instances.map((i) => i.status))
      )
    );
  }

  const sortedOpen = sortOpenItems(openItems, filters.orderBy ?? "date");
  const openLimit = filters.openLimit ?? 50;
  const openPaged = sortedOpen.slice(0, openLimit);

  const completedItems: CompletedOverviewItem[] = [];

  for (const plan of closedPlans) {
    const statuses = plan.runs.flatMap((run) => run.instances.map((i) => i.status));
    const metrics = buildRunProgressMetrics(statuses);
    const id = plan.id.toString();
    completedItems.push({
      id,
      type: "plan",
      name: plan.name,
      percentPassed: metrics.total === 0 ? 0 : Math.round((metrics.passed / metrics.total) * 100),
      closedAt: plan.updatedAt.toISOString(),
      viewPath: `plans/${id}`
    });
  }

  for (const run of closedRuns) {
    const metrics = buildRunProgressMetrics(run.instances.map((i) => i.status));
    const id = run.id.toString();
    completedItems.push({
      id,
      type: "run",
      name: run.name,
      percentPassed: metrics.total === 0 ? 0 : Math.round((metrics.passed / metrics.total) * 100),
      closedAt: (run.closedAt ?? run.createdAt).toISOString(),
      viewPath: `runs/${id}`
    });
  }

  const completedGroups = groupCompletedByDate(completedItems);

  return {
    open: { total: sortedOpen.length, items: openPaged },
    completed: { total: completedItems.length, groups: completedGroups },
    counts: {
      open: sortedOpen.length,
      completed: completedItems.length
    }
  };
}

async function buildRunsOverviewMemory(
  repo: RunsRepository,
  projectId: bigint,
  filters: OverviewFilters
): Promise<RunsOverviewResponse> {
  const plans = listMemoryPlans(projectId);
  const runs = await repo.listRunsByProject(projectId);
  const milestoneId = filters.milestoneId && filters.milestoneId !== "all" ? filters.milestoneId : null;

  const openItems: RunPlanOverviewItem[] = [];

  for (const plan of plans) {
    const planRuns = runs.filter((run) => run.planId?.toString() === plan.id.toString());
    if (milestoneId && planRuns.every((r) => r.milestoneId?.toString() !== milestoneId)) continue;
    const statuses: string[] = [];
    for (const run of planRuns) {
      const instances = await repo.listInstancesForRun(run.id);
      statuses.push(...instances.map((i) => i.status));
    }
    const hasOpenRun = planRuns.some((r) => r.status === "open");
    if (!hasOpenRun && planRuns.length > 0) continue;
    openItems.push(
      itemFromMetrics(
        {
          id: plan.id,
          type: "plan",
          name: plan.name,
          createdAt: new Date(),
          createdBy: plan.assignedTo ?? null
        },
        buildRunProgressMetrics(statuses)
      )
    );
  }

  for (const run of runs) {
    if (run.status !== "open" || run.planId != null) continue;
    if (milestoneId && run.milestoneId?.toString() !== milestoneId) continue;
    if (filters.mine && filters.userId != null && run.assignedTo?.toString() !== filters.userId.toString()) {
      continue;
    }
    const metrics = await loadRunProgressMetrics(repo, run.id);
    openItems.push(
      itemFromMetrics(
        {
          id: run.id,
          type: "run",
          name: run.name,
          createdAt: run.createdAt ?? new Date(),
          createdBy: run.assignedTo ?? null
        },
        metrics
      )
    );
  }

  const sortedOpen = sortOpenItems(openItems, filters.orderBy ?? "date");
  const openLimit = filters.openLimit ?? 50;

  const completedItems: CompletedOverviewItem[] = [];
  for (const run of runs) {
    if (run.status !== "closed" || run.planId != null) continue;
    if (milestoneId && run.milestoneId?.toString() !== milestoneId) continue;
    const metrics = await loadRunProgressMetrics(repo, run.id);
    completedItems.push({
      id: run.id.toString(),
      type: "run",
      name: run.name,
      percentPassed: metrics.total === 0 ? 0 : Math.round((metrics.passed / metrics.total) * 100),
      closedAt: (run.closedAt ?? run.createdAt ?? new Date()).toISOString(),
      viewPath: `runs/${run.id}`
    });
  }

  return {
    open: { total: sortedOpen.length, items: sortedOpen.slice(0, openLimit) },
    completed: { total: completedItems.length, groups: groupCompletedByDate(completedItems) },
    counts: { open: sortedOpen.length, completed: completedItems.length }
  };
}

export async function buildRunsOverview(
  projectId: bigint,
  deps: { prisma?: PrismaClient; repo: RunsRepository },
  filters: OverviewFilters = {}
): Promise<RunsOverviewResponse> {
  if (deps.prisma) {
    return buildRunsOverviewPrisma(deps.prisma, projectId, filters);
  }
  return buildRunsOverviewMemory(deps.repo, projectId, filters);
}
