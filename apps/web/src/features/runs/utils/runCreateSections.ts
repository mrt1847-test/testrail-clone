import type { SectionNode } from "../../cases/types";

export type RunCreateSectionRow = {
  id: string;
  name: string;
  parentSectionId?: string | null;
  displayOrder?: number;
};

export function mapRunCreateSections(rows: RunCreateSectionRow[], suiteId: string): SectionNode[] {
  const numericSuiteId = Number(suiteId);
  return rows.map((row) => ({
    id: Number(row.id),
    suiteId: Number.isNaN(numericSuiteId) ? 0 : numericSuiteId,
    name: row.name,
    parentSectionId: row.parentSectionId ? Number(row.parentSectionId) : null,
    displayOrder: row.displayOrder ?? 0
  }));
}

export function buildSectionDepthMap(sections: SectionNode[]) {
  const parentById = new Map<number, number | null>();
  for (const section of sections) {
    parentById.set(section.id, section.parentSectionId);
  }
  const memo = new Map<number, number>();
  const getDepth = (id: number): number => {
    if (memo.has(id)) return memo.get(id)!;
    const parent = parentById.get(id);
    const depth = parent != null ? Math.min(6, getDepth(parent) + 1) : 0;
    memo.set(id, depth);
    return depth;
  };
  for (const section of sections) getDepth(section.id);
  return memo;
}

export function buildDescendantIdsBySection(sections: SectionNode[]) {
  const childrenByParent = new Map<number | null, number[]>();
  for (const section of sections) {
    const parent = section.parentSectionId;
    const list = childrenByParent.get(parent) ?? [];
    list.push(section.id);
    childrenByParent.set(parent, list);
  }
  const memo = new Map<number, Set<number>>();
  const walk = (id: number): Set<number> => {
    if (memo.has(id)) return memo.get(id)!;
    const out = new Set<number>([id]);
    for (const childId of childrenByParent.get(id) ?? []) {
      for (const nestedId of walk(childId)) out.add(nestedId);
    }
    memo.set(id, out);
    return out;
  };
  for (const section of sections) walk(section.id);
  return memo;
}

export function buildSubtreeCaseCounts(
  sections: SectionNode[],
  cases: Array<{ sectionId?: string }>,
  descendantIdsBySectionId: Map<number, Set<number>>
) {
  const direct = new Map<number, number>();
  for (const row of cases) {
    if (!row.sectionId) continue;
    const key = Number(row.sectionId);
    if (Number.isNaN(key)) continue;
    direct.set(key, (direct.get(key) ?? 0) + 1);
  }
  const subtree = new Map<number, number>();
  for (const section of sections) {
    let count = 0;
    const descendants = descendantIdsBySectionId.get(section.id) ?? new Set([section.id]);
    for (const childId of descendants) count += direct.get(childId) ?? 0;
    subtree.set(section.id, count);
  }
  return subtree;
}
