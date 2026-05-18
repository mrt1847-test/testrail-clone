export type SectionTreeNode = {
  id: bigint;
  parentSectionId: bigint | null;
  displayOrder: number;
};

export function sortSectionsDepthFirst<T extends SectionTreeNode>(sections: T[]): T[] {
  const byParent = new Map<bigint | null, T[]>();
  for (const section of sections) {
    const parentKey = section.parentSectionId;
    const bucket = byParent.get(parentKey) ?? [];
    bucket.push(section);
    byParent.set(parentKey, bucket);
  }
  for (const bucket of byParent.values()) {
    bucket.sort((left, right) => left.displayOrder - right.displayOrder || Number(left.id - right.id));
  }
  const ordered: T[] = [];
  const walk = (parentId: bigint | null) => {
    for (const section of byParent.get(parentId) ?? []) {
      ordered.push(section);
      walk(section.id);
    }
  };
  walk(null);
  return ordered;
}
