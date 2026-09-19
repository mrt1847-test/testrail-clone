import type { CaseDisplayMode } from "../caseRepositoryView";
import type { CaseGroupBy, CaseRepositoryGroup } from "./caseRepositoryGrouping";
import { sectionPathLabel } from "./sectionTreeModel";

type SectionPathItem = {
  id: number;
  name: string;
  parentSectionId: number | null;
  displayOrder: number;
};

export function shouldShowCaseGroupHeaders(groupBy: CaseGroupBy, _display: CaseDisplayMode): boolean {
  return groupBy !== "none";
}

export function applySectionPathLabels(
  groups: CaseRepositoryGroup[],
  sections: SectionPathItem[]
): CaseRepositoryGroup[] {
  return groups.map((group) => {
    if (group.sectionId == null) return group;
    return { ...group, label: sectionPathLabel(sections, group.sectionId) };
  });
}

export function toggleCollapsedGroupKey(collapsed: Set<string>, key: string): Set<string> {
  const next = new Set(collapsed);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function collapseAllGroupKeys(keys: string[]): Set<string> {
  return new Set(keys);
}

export function expandAllGroupKeys(): Set<string> {
  return new Set();
}

export function collapsedHiddenSelectedCount(
  collapsed: boolean,
  selectedIds: Set<number>,
  caseIds: number[]
): number {
  if (!collapsed) return 0;
  return caseIds.reduce((count, caseId) => (selectedIds.has(caseId) ? count + 1 : count), 0);
}

export function sectionBlockToggleLabel(path: string, collapsed: boolean): string {
  return `${collapsed ? "Expand" : "Collapse"} ${path}`;
}
