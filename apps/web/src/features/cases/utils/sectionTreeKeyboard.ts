import type { SectionTreeNode } from "./sectionTreeOrder";

export type SectionTreeKeyInput = {
  key: string;
  shiftKey?: boolean;
  currentId: number | null;
  sections: SectionTreeNode[];
  collapsedIds: Iterable<number>;
};

export type SectionTreeKeyResult =
  | { type: "none" }
  | { type: "select"; sectionId: number }
  | { type: "expand"; sectionId: number }
  | { type: "collapse"; sectionId: number }
  | { type: "openActions" };

export function sectionCreateFieldId(parentSectionId: number | null) {
  return parentSectionId == null ? "case-repository-new-section" : `new-section-${parentSectionId}`;
}

function childrenOf<T extends SectionTreeNode>(sections: T[], parentId: number | null): T[] {
  return sections
    .filter((section) => section.parentSectionId === parentId)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);
}

export function visibleSectionIds<T extends SectionTreeNode>(
  sections: T[],
  collapsedIds: Iterable<number>
): number[] {
  const collapsed = collapsedIds instanceof Set ? collapsedIds : new Set(collapsedIds);
  const visible: number[] = [];
  const walk = (parentId: number | null) => {
    for (const section of childrenOf(sections, parentId)) {
      visible.push(section.id);
      if (!collapsed.has(section.id)) walk(section.id);
    }
  };
  walk(null);
  return visible;
}

export function resolveSectionTreeKey(input: SectionTreeKeyInput): SectionTreeKeyResult {
  const collapsedIds = input.collapsedIds instanceof Set ? input.collapsedIds : new Set(input.collapsedIds);
  const visible = visibleSectionIds(input.sections, collapsedIds);
  if (visible.length === 0) return { type: "none" };

  const currentId =
    input.currentId != null && visible.includes(input.currentId) ? input.currentId : visible[0]!;
  const index = visible.indexOf(currentId);
  const current = input.sections.find((section) => section.id === currentId);
  const childSections = childrenOf(input.sections, currentId);
  const hasChildren = childSections.length > 0;
  const expanded = hasChildren && !collapsedIds.has(currentId);
  const key = input.key;

  if (key === "ArrowDown" || key === "j" || key === "J") {
    const next = visible[Math.min(index + 1, visible.length - 1)];
    return next != null ? { type: "select", sectionId: next } : { type: "none" };
  }
  if (key === "ArrowUp" || key === "k" || key === "K") {
    const prev = visible[Math.max(index - 1, 0)];
    return prev != null ? { type: "select", sectionId: prev } : { type: "none" };
  }
  if (key === "Home") return { type: "select", sectionId: visible[0]! };
  if (key === "End") return { type: "select", sectionId: visible[visible.length - 1]! };
  if (key === "ArrowRight") {
    if (!hasChildren) return { type: "none" };
    if (!expanded) return { type: "expand", sectionId: currentId };
    return { type: "select", sectionId: childSections[0]!.id };
  }
  if (key === "ArrowLeft") {
    if (hasChildren && expanded) return { type: "collapse", sectionId: currentId };
    if (current?.parentSectionId != null) return { type: "select", sectionId: current.parentSectionId };
    return { type: "none" };
  }
  if (key === "Enter" || key === " ") return { type: "select", sectionId: currentId };
  if (key === "ContextMenu" || (key === "F10" && input.shiftKey)) return { type: "openActions" };
  return { type: "none" };
}
