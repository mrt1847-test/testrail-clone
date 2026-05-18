import { buildSuiteCaseGroups, type SuiteCaseGroupBy, type SuiteCaseGroupRow } from "./suiteCaseGrouping.js";
import type { TestInstance } from "../modules/runs/runs.types.js";

export type RunInstanceGroupBy = SuiteCaseGroupBy;

export type RunInstanceGroupRow = SuiteCaseGroupRow<TestInstance>;

export function buildRunInstanceGroups(
  instances: TestInstance[],
  sections: Array<{ id: bigint; name: string; displayOrder: number; parentSectionId: bigint | null }>,
  groupBy: RunInstanceGroupBy
): { groupBy: RunInstanceGroupBy; groups: RunInstanceGroupRow[] } {
  const withSection = instances.filter((row) => row.sectionId != null);
  const mapped = withSection.map((row) => ({
    ...row,
    sectionId: row.sectionId!,
    priority: row.casePriority ?? null,
    caseType: row.caseType ?? null
  }));
  return buildSuiteCaseGroups(mapped, sections, groupBy);
}

export function countInstancesBySection(instances: TestInstance[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of instances) {
    if (row.sectionId == null) continue;
    const key = row.sectionId.toString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
