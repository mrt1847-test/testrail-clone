type SectionTreeItem = {
  id: number;
  name: string;
  parentSectionId: number | null;
  displayOrder: number;
};

export type SectionDestination = {
  id: number | null;
  label: string;
};

export function collectSectionDescendantIds(sections: SectionTreeItem[], sectionId: number) {
  const byParent = new Map<number | null, SectionTreeItem[]>();
  for (const section of sections) {
    const parent = section.parentSectionId ?? null;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(section);
    byParent.set(parent, siblings);
  }

  const descendants = new Set<number>();
  const stack = [...(byParent.get(sectionId) ?? []).map((section) => section.id)];
  while (stack.length > 0) {
    const next = stack.pop()!;
    descendants.add(next);
    stack.push(...(byParent.get(next) ?? []).map((section) => section.id));
  }
  return descendants;
}

export function sectionPathLabel(sections: SectionTreeItem[], sectionId: number) {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const parts: string[] = [];
  const visited = new Set<number>();
  let current = byId.get(sectionId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    parts.unshift(current.name);
    current = current.parentSectionId == null ? undefined : byId.get(current.parentSectionId);
  }
  return parts.join(" / ");
}

/** Depth-first options with full parent paths so duplicate names stay distinguishable. */
export function sectionDestinationOptions(sections: SectionTreeItem[]): Array<{ id: number; label: string }> {
  const byParent = new Map<number | null, SectionTreeItem[]>();
  for (const section of sections) {
    const parent = section.parentSectionId ?? null;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(section);
    byParent.set(parent, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);
  }

  const out: Array<{ id: number; label: string }> = [];
  const walk = (parentId: number | null) => {
    for (const section of byParent.get(parentId) ?? []) {
      out.push({ id: section.id, label: sectionPathLabel(sections, section.id) });
      walk(section.id);
    }
  };
  walk(null);
  return out;
}

export function sectionMoveDestinations(sections: SectionTreeItem[], sourceSectionId: number): SectionDestination[] {
  const blocked = collectSectionDescendantIds(sections, sourceSectionId);
  blocked.add(sourceSectionId);
  return [
    { id: null, label: "Root level" },
    ...sectionDestinationOptions(sections).filter((section) => !blocked.has(section.id))
  ];
}
