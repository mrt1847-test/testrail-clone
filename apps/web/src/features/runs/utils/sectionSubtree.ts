import type { SectionNode } from "../../cases/types";

export function expandSectionSubtreeIds(sections: SectionNode[], rootSectionIds: number[]): Set<number> {
  if (rootSectionIds.length === 0) return new Set();
  const children = new Map<number | null, number[]>();
  for (const section of sections) {
    const parent = section.parentSectionId;
    const list = children.get(parent);
    if (list) list.push(section.id);
    else children.set(parent, [section.id]);
  }
  const out = new Set<number>();
  const stack = [...rootSectionIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const kids = children.get(id);
    if (kids) for (const kid of kids) stack.push(kid);
  }
  return out;
}
