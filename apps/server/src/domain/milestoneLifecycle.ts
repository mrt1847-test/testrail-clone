export type MilestoneLifecycleStatus = "upcoming" | "open" | "completed";

export type MilestoneLifecycleInput = {
  isCompleted: boolean;
  startDate?: Date | string | null;
  now?: Date;
};

export function resolveMilestoneLifecycleStatus(input: MilestoneLifecycleInput): MilestoneLifecycleStatus {
  if (input.isCompleted) return "completed";
  if (input.startDate) {
    const start = input.startDate instanceof Date ? input.startDate : new Date(input.startDate);
    if (!Number.isNaN(start.getTime()) && start.getTime() > (input.now ?? new Date()).getTime()) {
      return "upcoming";
    }
  }
  return "open";
}

export function milestoneLifecycleLabel(status: MilestoneLifecycleStatus) {
  if (status === "completed") return "Complete";
  if (status === "upcoming") return "Upcoming";
  return "Open";
}

type MilestoneParentNode = {
  id: bigint;
  parentMilestoneId?: bigint | null;
};

export function assertMilestoneParentLink(input: {
  milestoneId: bigint | null;
  parentMilestoneId: bigint | null;
  rows: MilestoneParentNode[];
}) {
  const { milestoneId, parentMilestoneId, rows } = input;
  if (parentMilestoneId == null) return;

  if (milestoneId != null && parentMilestoneId === milestoneId) {
    throw new Error("MILESTONE_PARENT_CYCLE");
  }

  const byId = new Map(rows.map((row) => [row.id.toString(), row]));
  if (!byId.has(parentMilestoneId.toString())) {
    throw new Error("MILESTONE_PARENT_NOT_FOUND");
  }

  let cursor: bigint | null | undefined = parentMilestoneId;
  const visited = new Set<string>();
  while (cursor != null) {
    const key = cursor.toString();
    if (milestoneId != null && key === milestoneId.toString()) {
      throw new Error("MILESTONE_PARENT_CYCLE");
    }
    if (visited.has(key)) {
      throw new Error("MILESTONE_PARENT_CYCLE");
    }
    visited.add(key);
    cursor = byId.get(key)?.parentMilestoneId ?? null;
  }
}

export function orderMilestonesForHierarchy<
  T extends { id: string; parentMilestoneId?: string | null; name: string }
>(rows: T[]) {
  const childrenByParent = new Map<string | null, T[]>();
  for (const row of rows) {
    const parentKey = row.parentMilestoneId ?? null;
    const bucket = childrenByParent.get(parentKey) ?? [];
    bucket.push(row);
    childrenByParent.set(parentKey, bucket);
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name));
  }

  const ordered: Array<T & { depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const row of childrenByParent.get(parentId) ?? []) {
      ordered.push({ ...row, depth });
      visit(row.id, depth + 1);
    }
  };
  visit(null, 0);
  return ordered;
}
