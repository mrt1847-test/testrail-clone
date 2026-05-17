import {
  resolveMilestoneLifecycleStatus,
  type MilestoneLifecycleStatus
} from "./milestoneLifecycle.js";

export type MilestoneDirectMetrics = {
  statuses: string[];
  runCount: number;
  openRunCount: number;
};

export type MilestoneSummaryMeta = {
  milestoneId: string;
  name: string;
  parentMilestoneId: string | null;
  isCompleted: boolean;
  startDate?: Date | string | null;
};

export type MilestoneSummaryItem = {
  milestoneId: string;
  name: string;
  parentMilestoneId: string | null;
  isCompleted: boolean;
  lifecycleStatus: MilestoneLifecycleStatus;
  childCount: number;
  runCount: number;
  openRunCount: number;
  total: number;
  passed: number;
  failed: number;
  progress: number;
  directRunCount: number;
  directTotal: number;
  directProgress: number;
  includesSubMilestones: boolean;
};

export type MilestoneDashboardTopItem = {
  milestoneId: string;
  name: string;
  parentMilestoneId: string | null;
  lifecycleStatus: MilestoneLifecycleStatus;
  childCount: number;
  progress: number;
  runCount: number;
  includesSubMilestones: boolean;
};

export type MilestoneDashboard = {
  milestoneCount: number;
  rootCount: number;
  openCount: number;
  upcomingCount: number;
  completedCount: number;
  withSubMilestonesCount: number;
  linkedRunCount: number;
  totalTests: number;
  passed: number;
  failed: number;
  progress: number;
  topMilestones: MilestoneDashboardTopItem[];
};

function metricsFromStatuses(statuses: string[]) {
  let passed = 0;
  let failed = 0;
  for (const status of statuses) {
    if (status === "passed") passed += 1;
    else if (status === "failed") failed += 1;
  }
  const total = statuses.length;
  const progress = total === 0 ? 0 : Math.round((passed / total) * 100);
  return { total, passed, failed, progress };
}

function collectDescendantIds(milestoneId: string, childrenByParent: Map<string, string[]>) {
  const out: string[] = [];
  const visited = new Set<string>();
  const stack = [...(childrenByParent.get(milestoneId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    out.push(id);
    for (const childId of childrenByParent.get(id) ?? []) {
      if (!visited.has(childId)) stack.push(childId);
    }
  }
  return out;
}

export function enrichMilestoneSummaries(
  milestones: MilestoneSummaryMeta[],
  directById: Map<string, MilestoneDirectMetrics>
): MilestoneSummaryItem[] {
  const childrenByParent = new Map<string, string[]>();
  for (const row of milestones) {
    if (!row.parentMilestoneId) continue;
    const bucket = childrenByParent.get(row.parentMilestoneId) ?? [];
    bucket.push(row.milestoneId);
    childrenByParent.set(row.parentMilestoneId, bucket);
  }

  const childCountById = new Map<string, number>();
  for (const row of milestones) {
    childCountById.set(row.milestoneId, childrenByParent.get(row.milestoneId)?.length ?? 0);
  }

  return milestones.map((row) => {
    const direct = directById.get(row.milestoneId) ?? { statuses: [], runCount: 0, openRunCount: 0 };
    const directMetrics = metricsFromStatuses(direct.statuses);
    const descendantIds = collectDescendantIds(row.milestoneId, childrenByParent);
    const rollupStatuses = [...direct.statuses];
    let rollupRunCount = direct.runCount;
    let rollupOpenRunCount = direct.openRunCount;

    for (const childId of descendantIds) {
      const child = directById.get(childId);
      if (!child) continue;
      rollupStatuses.push(...child.statuses);
      rollupRunCount += child.runCount;
      rollupOpenRunCount += child.openRunCount;
    }

    const rollupMetrics = metricsFromStatuses(rollupStatuses);
    const childCount = childCountById.get(row.milestoneId) ?? 0;
    const includesSubMilestones =
      childCount > 0 &&
      (rollupRunCount > direct.runCount ||
        rollupMetrics.total > directMetrics.total ||
        rollupMetrics.progress !== directMetrics.progress);

    return {
      milestoneId: row.milestoneId,
      name: row.name,
      parentMilestoneId: row.parentMilestoneId,
      isCompleted: row.isCompleted,
      lifecycleStatus: resolveMilestoneLifecycleStatus({
        isCompleted: row.isCompleted,
        startDate: row.startDate
      }),
      childCount,
      runCount: rollupRunCount,
      openRunCount: rollupOpenRunCount,
      total: rollupMetrics.total,
      passed: rollupMetrics.passed,
      failed: rollupMetrics.failed,
      progress: rollupMetrics.progress,
      directRunCount: direct.runCount,
      directTotal: directMetrics.total,
      directProgress: directMetrics.progress,
      includesSubMilestones
    };
  });
}

export function buildMilestoneDashboard(
  items: MilestoneSummaryItem[],
  options?: { topLimit?: number }
): MilestoneDashboard {
  const topLimit = options?.topLimit ?? 5;
  const roots = items.filter((row) => !row.parentMilestoneId);
  let linkedRunCount = 0;
  let totalTests = 0;
  let passed = 0;
  let failed = 0;

  for (const root of roots) {
    linkedRunCount += root.runCount;
    totalTests += root.total;
    passed += root.passed;
    failed += root.failed;
  }

  const progress = totalTests === 0 ? 0 : Math.round((passed / totalTests) * 100);
  const openCount = items.filter((row) => row.lifecycleStatus === "open").length;
  const upcomingCount = items.filter((row) => row.lifecycleStatus === "upcoming").length;
  const completedCount = items.filter((row) => row.lifecycleStatus === "completed").length;

  const topMilestones = [...roots]
    .sort((a, b) => b.progress - a.progress || b.runCount - a.runCount || a.name.localeCompare(b.name))
    .slice(0, topLimit)
    .map((row) => ({
      milestoneId: row.milestoneId,
      name: row.name,
      parentMilestoneId: row.parentMilestoneId,
      lifecycleStatus: row.lifecycleStatus,
      childCount: row.childCount,
      progress: row.progress,
      runCount: row.runCount,
      includesSubMilestones: row.includesSubMilestones
    }));

  return {
    milestoneCount: items.length,
    rootCount: roots.length,
    openCount,
    upcomingCount,
    completedCount,
    withSubMilestonesCount: items.filter((row) => row.childCount > 0).length,
    linkedRunCount,
    totalTests,
    passed,
    failed,
    progress,
    topMilestones
  };
}

export function buildMilestoneSummaryPayload(
  milestones: MilestoneSummaryMeta[],
  directById: Map<string, MilestoneDirectMetrics>
) {
  const items = enrichMilestoneSummaries(milestones, directById);
  return { items, dashboard: buildMilestoneDashboard(items) };
}
