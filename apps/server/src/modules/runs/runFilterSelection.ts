export type FilterSelectionMode = "set" | "add" | "remove";

export function applyIdSelectionMode(
  mode: FilterSelectionMode,
  current: readonly string[],
  matching: readonly string[]
): string[] {
  const matchingSet = new Set(matching);
  if (mode === "set") return [...matching];
  if (mode === "add") {
    const out = new Set(current);
    for (const id of matching) out.add(id);
    return [...out];
  }
  return current.filter((id) => !matchingSet.has(id));
}

/** include-all / dynamic runs store exclusions; selection = suite cases minus excluded */
export function applyExcludedSelectionMode(
  mode: FilterSelectionMode,
  allCaseIds: readonly string[],
  currentExcluded: readonly string[],
  matching: readonly string[]
): string[] {
  const matchingSet = new Set(matching);
  const selected = new Set(allCaseIds.filter((id) => !currentExcluded.includes(id)));

  if (mode === "set") {
    return allCaseIds.filter((id) => !matchingSet.has(id));
  }
  if (mode === "add") {
    for (const id of matching) selected.add(id);
    return allCaseIds.filter((id) => !selected.has(id));
  }
  for (const id of matching) selected.delete(id);
  return allCaseIds.filter((id) => !selected.has(id));
}
