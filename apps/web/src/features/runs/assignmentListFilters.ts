export type DueFilterMode = "all" | "unset" | "overdue" | "due_by";

export type AssignmentListFilterState = {
  status: string;
  runId: string;
  search: string;
  milestoneId: string;
  dueFilter: DueFilterMode;
  dueBy: string;
};

export const defaultAssignmentListFilters: AssignmentListFilterState = {
  status: "all",
  runId: "all",
  search: "",
  milestoneId: "all",
  dueFilter: "all",
  dueBy: ""
};

import type { AssignmentListFiltersInput } from "./api/runApi";

export function assignmentListFiltersToApi(filters: AssignmentListFilterState): AssignmentListFiltersInput {
  const api: AssignmentListFiltersInput = {
    status: filters.status,
    runId: filters.runId,
    q: filters.search
  };
  if (filters.milestoneId === "none") api.milestoneId = "none";
  else if (filters.milestoneId !== "all") api.milestoneId = filters.milestoneId;
  if (filters.dueFilter === "unset") api.dueUnset = true;
  else if (filters.dueFilter === "overdue") api.overdue = true;
  else if (filters.dueFilter === "due_by" && filters.dueBy.trim()) {
    const end = new Date(`${filters.dueBy.trim()}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) api.dueBefore = end.toISOString();
  }
  return api;
}

export function appendAssignmentListQueryParams(
  params: URLSearchParams,
  filters: AssignmentListFilterState
) {
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.runId !== "all") params.set("runId", filters.runId);
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.milestoneId === "none") params.set("milestoneId", "none");
  else if (filters.milestoneId !== "all") params.set("milestoneId", filters.milestoneId);
  if (filters.dueFilter === "unset") params.set("dueUnset", "true");
  else if (filters.dueFilter === "overdue") params.set("overdue", "true");
  else if (filters.dueFilter === "due_by" && filters.dueBy.trim()) {
    const end = new Date(`${filters.dueBy.trim()}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) params.set("dueBefore", end.toISOString());
  }
}

export function formatRunDueOn(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export function isRunDueOverdue(iso: string | null | undefined) {
  if (!iso) return false;
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}
