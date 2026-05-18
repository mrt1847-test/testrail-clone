export type RunListColumn = "priority" | "type";

export const defaultRunListColumns: RunListColumn[] = ["priority"];

export const RUN_LIST_COLUMN_LABELS: Record<RunListColumn, string> = {
  priority: "Priority",
  type: "Type"
};
