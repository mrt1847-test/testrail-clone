export type SectionTreeNode = {
  id: number;
  parentSectionId: number | null;
  displayOrder: number;
};

/** Depth-first section order (siblings by displayOrder, then id). */
export function sortSectionsDepthFirst<T extends SectionTreeNode>(sections: T[]): T[] {
  const byParent = new Map<number | null, T[]>();
  for (const section of sections) {
    const parentKey = section.parentSectionId;
    const bucket = byParent.get(parentKey) ?? [];
    bucket.push(section);
    byParent.set(parentKey, bucket);
  }
  for (const bucket of byParent.values()) {
    bucket.sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);
  }
  const ordered: T[] = [];
  const walk = (parentId: number | null) => {
    for (const section of byParent.get(parentId) ?? []) {
      ordered.push(section);
      walk(section.id);
    }
  };
  walk(null);
  return ordered;
}

export function sortSectionIdsDepthFirst(sections: SectionTreeNode[]): number[] {
  return sortSectionsDepthFirst(sections).map((section) => section.id);
}
