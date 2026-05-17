export type MilestoneLifecycleStatus = "upcoming" | "open" | "completed";

export function milestoneStatusLabel(status: MilestoneLifecycleStatus) {
  if (status === "completed") return "Complete";
  if (status === "upcoming") return "Upcoming";
  return "Open";
}

export function milestoneStatusClass(status: MilestoneLifecycleStatus) {
  if (status === "completed") return "bg-emerald-50 text-emerald-800";
  if (status === "upcoming") return "bg-amber-50 text-amber-900";
  return "bg-sky-50 text-sky-800";
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
