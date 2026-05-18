import type { TestCase } from "../types";

export type CaseGroupBy = "section_id" | "priority" | "type" | "none";

export const CASE_GROUP_BY_OPTIONS: Array<{ id: CaseGroupBy; label: string }> = [
  { id: "section_id", label: "Section" },
  { id: "priority", label: "Priority" },
  { id: "type", label: "Type" },
  { id: "none", label: "No grouping" }
];

export function parseCaseGroupBy(value: string | null): CaseGroupBy {
  if (value === "priority" || value === "type" || value === "none") return value;
  return "section_id";
}

export type CaseRepositoryGroup = {
  key: string;
  label: string;
  sectionId?: number;
  depth?: number;
  cases: TestCase[];
};

const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const typeOrder: Record<string, number> = { Functional: 0, Integration: 1, Regression: 2 };

export type FetchedSuiteCaseGroup = {
  groupKey: string;
  groupLabel: string;
  sectionId: number | null;
  cases: TestCase[];
};

export function mapFetchedSuiteGroups(input: {
  groups: FetchedSuiteCaseGroup[];
  groupBy: CaseGroupBy;
  sectionDepthById: Map<number, number>;
}): CaseRepositoryGroup[] {
  const { groups, groupBy, sectionDepthById } = input;

  if (groupBy === "none") {
    const flat = groups.flatMap((group) => group.cases);
    return flat.length > 0 ? [{ key: "all", label: "", cases: flat }] : [];
  }

  return groups.map((group) => ({
    key: group.groupKey,
    label: group.groupLabel,
    sectionId: group.sectionId ?? undefined,
    depth: group.sectionId != null ? sectionDepthById.get(group.sectionId) : undefined,
    cases: group.cases
  }));
}

export function regroupRepositoryCases(input: {
  sectionGroups: Array<{ sectionId: number; sectionName: string; cases: TestCase[] }>;
  groupBy: CaseGroupBy;
  sectionDepthById: Map<number, number>;
}): CaseRepositoryGroup[] {
  const { sectionGroups, groupBy, sectionDepthById } = input;
  const flat = sectionGroups.flatMap((group) => group.cases);

  if (groupBy === "none") {
    return flat.length > 0 ? [{ key: "all", label: "", cases: flat }] : [];
  }

  if (groupBy === "section_id") {
    return sectionGroups.map((group) => ({
      key: `section-${group.sectionId}`,
      label: group.sectionName,
      sectionId: group.sectionId,
      depth: sectionDepthById.get(group.sectionId) ?? 0,
      cases: group.cases
    }));
  }

  const bucket = new Map<string, TestCase[]>();
  for (const item of flat) {
    const label = groupBy === "priority" ? item.priority : item.type;
    const list = bucket.get(label);
    if (list) list.push(item);
    else bucket.set(label, [item]);
  }

  const sortKeys =
    groupBy === "priority"
      ? (left: string, right: string) => (priorityOrder[left] ?? 99) - (priorityOrder[right] ?? 99)
      : (left: string, right: string) => (typeOrder[left] ?? 99) - (typeOrder[right] ?? 99);

  return Array.from(bucket.entries())
    .sort(([left], [right]) => sortKeys(left, right))
    .map(([label, cases]) => ({
      key: `${groupBy}-${label}`,
      label,
      cases
    }));
}
