import type { RunListColumn } from "./runInstanceColumns";

export const RUN_EXECUTION_ESSENTIAL_COLUMNS = ["select", "case", "title", "status"] as const;

export type RunExecutionOptionalColumn = "priority" | "type" | "updated" | "assignee" | "watch";

/** Matches `.run-instance-table` @container queries in index.css. */
export const RUN_EXECUTION_OPTIONAL_COLUMN_BREAKPOINTS = {
  assigneeAndPriority: 500,
  metadata: 640
} as const;

export function runExecutionOptionalColumnVisibility(input: {
  containerWidth: number;
  requestedColumns?: readonly RunListColumn[];
  showWatch?: boolean;
}): Record<RunExecutionOptionalColumn, boolean> {
  const requested = input.requestedColumns ?? [];
  const showWatch = input.showWatch ?? true;
  const medium = input.containerWidth >= RUN_EXECUTION_OPTIONAL_COLUMN_BREAKPOINTS.assigneeAndPriority;
  const wide = input.containerWidth >= RUN_EXECUTION_OPTIONAL_COLUMN_BREAKPOINTS.metadata;
  return {
    priority: medium && requested.includes("priority"),
    assignee: medium,
    type: wide && requested.includes("type"),
    updated: wide,
    watch: wide && showWatch
  };
}
