export type FilterSelectionMode = "set" | "add" | "remove";

export type RunCreateCaseRow = {
  id: string;
  priority?: string | null;
  sectionId?: string;
  archived?: boolean;
};

export function matchCasesByCreateFilter(
  cases: RunCreateCaseRow[],
  filter: {
    priority?: "" | "low" | "medium" | "high";
    state?: "active" | "archived";
    includedSectionIds?: string[];
    includedScopedCaseIds?: Set<string>;
  }
): string[] {
  return cases
    .filter((row) => {
      if (filter.priority && row.priority !== filter.priority) return false;
      if (filter.state === "archived" && !row.archived) return false;
      if (filter.state === "active" && row.archived) return false;
      if (filter.includedSectionIds?.length) {
        return filter.includedScopedCaseIds?.has(row.id) ?? false;
      }
      return true;
    })
    .map((row) => row.id);
}

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
