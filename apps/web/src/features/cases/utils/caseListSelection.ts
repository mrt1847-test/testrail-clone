import type { CaseListFilters } from "../types";

export function hasActiveCaseListFilters(filters: CaseListFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    filters.priority !== "" ||
    filters.caseType !== "" ||
    filters.automation !== "" ||
    filters.refs !== "" ||
    filters.labels !== "" ||
    filters.estimate !== "" ||
    filters.state !== "active"
  );
}

/** Filters for every case in the selected section (direct children only), ignoring list search/filter chips. */
export function buildSectionOnlyFilters(filters: CaseListFilters): CaseListFilters {
  return {
    q: "",
    priority: "",
    caseType: "",
    automation: "",
    refs: "",
    labels: "",
    estimate: "",
    sectionScope: "direct",
    state: filters.state
  };
}

export function mergeNumericIds(current: ReadonlySet<number>, ids: readonly number[]): Set<number> {
  const next = new Set(current);
  for (const id of ids) next.add(id);
  return next;
}
