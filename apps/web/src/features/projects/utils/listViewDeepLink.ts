/** Query keys preserved in shareable deep links per workbench list view. */
export const CASE_REPOSITORY_PARAM_KEYS = [
  "suiteId",
  "sectionId",
  "panelCaseId",
  "panelMode",
  "focusCaseId",
  "display",
  "groupBy",
  "q",
  "priority",
  "caseType",
  "automation",
  "refs",
  "labels",
  "estimate",
  "state",
  "columns"
] as const;

export const RUN_LIST_PARAM_KEYS = ["mine", "milestoneId", "resultStatus", "highlightRunId"] as const;

export const RUN_EXECUTION_PARAM_KEYS = [
  "status",
  "assignee",
  "q",
  "page",
  "testId",
  "sectionId",
  "groupBy",
  "display",
  "priority",
  "caseType",
  "caseChanged",
  "sortBy",
  "sortDir"
] as const;

export type ListViewScope = "case-repository" | "run-list" | "run-execution";

const KEYS_BY_SCOPE: Record<ListViewScope, readonly string[]> = {
  "case-repository": CASE_REPOSITORY_PARAM_KEYS,
  "run-list": RUN_LIST_PARAM_KEYS,
  "run-execution": RUN_EXECUTION_PARAM_KEYS
};

export function pickSearchParams(source: URLSearchParams, keys: readonly string[]): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value != null && value !== "") out.set(key, value);
  }
  return out;
}

export function captureListStateFromSearch(
  search: string | URLSearchParams,
  scope: ListViewScope
): URLSearchParams {
  const source = typeof search === "string" ? new URLSearchParams(search) : search;
  return pickSearchParams(source, KEYS_BY_SCOPE[scope]);
}

export function captureListStateFromLocation(scope: ListViewScope): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return captureListStateFromSearch(window.location.search, scope);
}

export function mergeSearchParams(basePath: string, extra: URLSearchParams): string {
  if (extra.size === 0) return basePath;
  const question = basePath.indexOf("?");
  const path = question >= 0 ? basePath.slice(0, question) : basePath;
  const merged = new URLSearchParams(question >= 0 ? basePath.slice(question + 1) : "");
  extra.forEach((value, key) => merged.set(key, value));
  const query = merged.toString();
  return query ? `${path}?${query}` : path;
}

export function detectListViewScope(pathname: string): ListViewScope | null {
  if (/\/projects\/[^/]+\/cases\/?$/.test(pathname)) return "case-repository";
  if (/\/projects\/[^/]+\/runs\/?$/.test(pathname)) return "run-list";
  if (/\/projects\/[^/]+\/runs\/[^/]+\/?$/.test(pathname)) return "run-execution";
  return null;
}

export function captureListStateForEntityShare(
  kind: "case" | "run" | "milestone" | "plan",
  pathname: string,
  search: string
): URLSearchParams {
  if (kind === "case") {
    const params = captureListStateFromSearch(search, "case-repository");
    return params;
  }
  if (kind === "run") {
    if (/\/projects\/[^/]+\/runs\/?$/.test(pathname)) {
      return captureListStateFromSearch(search, "run-list");
    }
    return captureListStateFromSearch(search, "run-execution");
  }
  return new URLSearchParams();
}
