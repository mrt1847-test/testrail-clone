import { sectionPathLabel } from "./sectionTreeModel";
import { sortSectionIdsDepthFirst } from "./sectionTreeOrder";
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
  displayLabel?: string;
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

/** Add only ancestors of loaded groups; context rows never change query membership. */
export function buildSectionHierarchy(
  groups: CaseRepositoryGroup[],
  sections: Array<{ id: number; name: string; parentSectionId: number | null; displayOrder: number }>,
  scopeRootId: number | null
): CaseRepositoryGroup[] {
  const sectionsById = new Map(sections.map(section => [section.id, section]));
  const groupsById = new Map(groups.filter(group => group.sectionId != null).map(group => [group.sectionId!, group]));
  const included = new Set(groupsById.keys());
  for (const id of groupsById.keys()) {
    let current = sectionsById.get(id);
    const visited = new Set<number>();
    while (current && current.id !== scopeRootId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = current.parentSectionId == null ? undefined : sectionsById.get(current.parentSectionId);
      if (!parent) break;
      included.add(parent.id);
      current = parent;
    }
  }
  const result = sortSectionIdsDepthFirst(sections).filter(id => included.has(id)).map(id => {
    const section = sectionsById.get(id)!;
    let depth = 0;
    let parentId = section.parentSectionId;
    const visited = new Set([id]);
    while (id !== scopeRootId && parentId != null && included.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      depth++;
      if (parentId === scopeRootId) break;
      parentId = sectionsById.get(parentId)?.parentSectionId ?? null;
    }
    return {
      ...(groupsById.get(id) ?? { key: 'section-' + id, sectionId: id, cases: [] }),
      label: sectionPathLabel(sections, id),
      displayLabel: section.name,
      depth
    };
  });
  // Preserve every loaded group even when stale metadata leaves a section unreachable.
  const renderedIds = new Set(result.map(group => group.sectionId));
  return [...result, ...groups.filter(group => group.sectionId == null || !renderedIds.has(group.sectionId))];
}
