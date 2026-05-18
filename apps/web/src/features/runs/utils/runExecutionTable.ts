import type { RunInstanceGroupBy } from "../types";
import type { RunSortBy } from "./runInstanceListParams";

export const RUN_GROUP_BY_OPTIONS: Array<{ id: RunInstanceGroupBy; label: string }> = [
  { id: "section_id", label: "Section" },
  { id: "priority", label: "Priority" },
  { id: "type", label: "Type" },
  { id: "none", label: "No grouping" }
];

export const RUN_SORT_OPTIONS: Array<{ id: RunSortBy; label: string }> = [
  { id: "case_id", label: "Case ID" },
  { id: "title", label: "Title" },
  { id: "status", label: "Status" },
  { id: "priority", label: "Priority" },
  { id: "type", label: "Type" },
  { id: "assignee", label: "Assignee" }
];
