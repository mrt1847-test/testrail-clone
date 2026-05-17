export type RangeMultiSelectClick<TId> = {
  orderedIds: readonly TId[];
  clickedId: TId;
  selected: ReadonlySet<TId>;
  anchorIndex: number | null;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type RangeMultiSelectClickResult<TId> =
  | { kind: "applied"; selected: Set<TId>; anchorIndex: number }
  | { kind: "default" };

/** Shift range-select and Ctrl/Cmd toggle; normal clicks use checkbox onChange. */
export function resolveRangeMultiSelectClick<TId>(
  input: RangeMultiSelectClick<TId>
): RangeMultiSelectClickResult<TId> {
  const clickedIndex = input.orderedIds.indexOf(input.clickedId);
  if (clickedIndex < 0) return { kind: "default" };

  const toggleModifier = input.ctrlKey || input.metaKey;

  if (input.shiftKey && input.anchorIndex != null && input.anchorIndex >= 0) {
    const start = Math.min(input.anchorIndex, clickedIndex);
    const end = Math.max(input.anchorIndex, clickedIndex);
    const next = new Set(input.selected);
    for (let i = start; i <= end; i++) {
      next.add(input.orderedIds[i]!);
    }
    return { kind: "applied", selected: next, anchorIndex: clickedIndex };
  }

  if (toggleModifier) {
    const next = new Set(input.selected);
    if (next.has(input.clickedId)) next.delete(input.clickedId);
    else next.add(input.clickedId);
    return { kind: "applied", selected: next, anchorIndex: clickedIndex };
  }

  return { kind: "default" };
}

export function hasRangeMultiSelectModifier(event: {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey;
}
