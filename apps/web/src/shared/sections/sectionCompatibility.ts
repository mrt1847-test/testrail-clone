/** Saved view shape used for section-id reconciliation (subset of SavedCaseView). */
export type SavedViewSectionRef = {
  id: string;
  sectionId: number | null;
};

export function buildValidSectionIdSet(sectionIds: Iterable<number>): Set<number> {
  return new Set(sectionIds);
}

/** Drop run-composition section roots that no longer exist in the suite tree. */
export function pruneSectionRootIds(
  rootIds: readonly string[],
  validSectionIds: ReadonlySet<number>
): { nextRootIds: string[]; removedRootIds: string[] } {
  const removedRootIds: string[] = [];
  const nextRootIds: string[] = [];
  for (const raw of rootIds) {
    const id = Number(raw);
    if (Number.isNaN(id) || !validSectionIds.has(id)) {
      removedRootIds.push(raw);
    } else {
      nextRootIds.push(raw);
    }
  }
  return { nextRootIds, removedRootIds };
}

/** Clear saved-view section anchors that point at deleted or missing sections. */
export function reconcileSavedViews<T extends SavedViewSectionRef>(
  views: readonly T[],
  validSectionIds: ReadonlySet<number>
): T[] {
  let changed = false;
  const next = views.map((view) => {
    if (view.sectionId == null || validSectionIds.has(view.sectionId)) return view;
    changed = true;
    return { ...view, sectionId: null };
  });
  return changed ? next : (views as T[]);
}

export function sectionIdsSignature(validSectionIds: ReadonlySet<number>): string {
  return Array.from(validSectionIds)
    .sort((a, b) => a - b)
    .join(",");
}
