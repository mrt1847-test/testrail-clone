import {
  activeAssignmentStatuses,
  isActiveAssignmentStatus,
  summarizeAssignmentAging,
  type AssignmentAgingLevel
} from "@testrail-clone/shared";

export type UserWorkloadRowInput = {
  userId: string;
  name: string;
  email: string;
  status: string;
  agingLevel: AssignmentAgingLevel;
};

export type UserWorkloadSummaryItem = {
  userId: string;
  name: string;
  email: string;
  assignedCount: number;
  activeCount: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  retestCount: number;
  untestedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  staleCount: number;
};

export type UserWorkloadSummaryReport = {
  totalAssignees: number;
  totalAssignedTests: number;
  totalActiveTests: number;
  unassignedActiveCount: number;
  items: UserWorkloadSummaryItem[];
};

function statusCount(statuses: string[], target: string) {
  return statuses.filter((status) => status === target).length;
}

export function buildUserWorkloadSummary(
  rows: UserWorkloadRowInput[],
  unassignedActiveCount = 0
): UserWorkloadSummaryReport {
  const byUser = new Map<string, UserWorkloadRowInput[]>();
  for (const row of rows) {
    const bucket = byUser.get(row.userId) ?? [];
    bucket.push(row);
    byUser.set(row.userId, bucket);
  }

  const items = [...byUser.entries()]
    .map(([userId, userRows]) => {
      const sample = userRows[0]!;
      const statuses = userRows.map((row) => row.status);
      const aging = summarizeAssignmentAging(userRows.map((row) => row.agingLevel));
      return {
        userId,
        name: sample.name,
        email: sample.email,
        assignedCount: userRows.length,
        activeCount: statuses.filter(isActiveAssignmentStatus).length,
        passedCount: statusCount(statuses, "passed"),
        failedCount: statusCount(statuses, "failed"),
        blockedCount: statusCount(statuses, "blocked"),
        retestCount: statusCount(statuses, "retest"),
        untestedCount: statusCount(statuses, "untested"),
        overdueCount: aging.overdue,
        dueSoonCount: aging.dueSoon,
        staleCount: aging.stale
      };
    })
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name));

  const totalAssignedTests = rows.length;
  const totalActiveTests = rows.filter((row) =>
    (activeAssignmentStatuses as readonly string[]).includes(row.status)
  ).length;

  return {
    totalAssignees: items.length,
    totalAssignedTests,
    totalActiveTests,
    unassignedActiveCount,
    items
  };
}
