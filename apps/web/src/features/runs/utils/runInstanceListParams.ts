export type RunFilterPriority = "" | "low" | "medium" | "high";
export type RunFilterCaseType = "" | "functional" | "integration" | "regression";
export type RunSortBy = "case_id" | "title" | "status" | "priority" | "type" | "assignee";
export type RunSortDir = "asc" | "desc";

export type RunInstanceListFilters = {
  status: string;
  assignee: string;
  search: string;
  priority: RunFilterPriority;
  caseType: RunFilterCaseType;
  caseChanged: boolean;
  sortBy: RunSortBy;
  sortDir: RunSortDir;
};

export const defaultRunInstanceListFilters: RunInstanceListFilters = {
  status: "all",
  assignee: "all",
  search: "",
  priority: "",
  caseType: "",
  caseChanged: false,
  sortBy: "case_id",
  sortDir: "asc"
};

export function appendRunInstanceListParams(params: URLSearchParams, filters: RunInstanceListFilters) {
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.assignee && filters.assignee !== "all") params.set("assignedTo", filters.assignee);
  if (filters.assignee === "") params.set("assignedTo", "null");
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.caseType) params.set("caseType", filters.caseType);
  if (filters.caseChanged) params.set("caseChanged", "true");
  if (filters.sortBy !== "case_id") params.set("sortBy", filters.sortBy);
  if (filters.sortDir !== "asc") params.set("sortDir", filters.sortDir);
}

export function countActiveRunListFilters(filters: RunInstanceListFilters) {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.assignee !== "all") count += 1;
  if (filters.priority) count += 1;
  if (filters.caseType) count += 1;
  if (filters.caseChanged) count += 1;
  return count;
}
