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

export function parseAssignmentListFilters(search: URLSearchParams): AssignmentListFilterState {
  const dueBefore = search.get("dueBefore");
  let dueFilter: DueFilterMode = "all";
  let dueBy = "";
  if (search.get("dueUnset") === "true") dueFilter = "unset";
  else if (search.get("overdue") === "true") dueFilter = "overdue";
  else if (dueBefore) {
    dueFilter = "due_by";
    const date = new Date(dueBefore);
    if (!Number.isNaN(date.getTime())) dueBy = date.toISOString().slice(0, 10);
  }
  return {
    status: search.get("status") || "all",
    runId: search.get("runId") || "all",
    search: search.get("q") || "",
    milestoneId: search.get("milestoneId") || "all",
    dueFilter,
    dueBy
  };
}

export function assignmentFiltersAreDefault(filters: AssignmentListFilterState) {
  return countActiveAssignmentFilters(filters) === 0;
}

export function countActiveAssignmentFilters(filters: AssignmentListFilterState) {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.runId !== "all") count += 1;
  if (filters.search.trim()) count += 1;
  if (filters.milestoneId !== "all") count += 1;
  if (filters.dueFilter !== "all") count += 1;
  return count;
}

export function describeActiveAssignmentFilters(
  filters: AssignmentListFilterState,
  labels: { runName?: string; milestoneName?: string } = {}
) {
  const parts: string[] = [];
  if (filters.search.trim()) parts.push(`Search: ${filters.search.trim()}`);
  if (filters.status !== "all") parts.push(`Status: ${filters.status}`);
  if (filters.runId !== "all") parts.push(`Run: ${labels.runName || filters.runId}`);
  if (filters.milestoneId === "none") parts.push("No milestone");
  else if (filters.milestoneId !== "all") {
    parts.push(`Milestone: ${labels.milestoneName || filters.milestoneId}`);
  }
  if (filters.dueFilter === "unset") parts.push("No due date");
  if (filters.dueFilter === "overdue") parts.push("Overdue");
  if (filters.dueFilter === "due_by") {
    parts.push(filters.dueBy.trim() ? `Due on or before ${filters.dueBy}` : "Due on or before");
  }
  return parts;
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
