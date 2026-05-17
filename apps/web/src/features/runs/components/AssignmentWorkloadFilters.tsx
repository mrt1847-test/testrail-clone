import type { FilterField } from "../../../shared/ui/FilterBar";
import type { MilestoneRow } from "../../projects/api/planningApi";
import type { AssignmentListFilterState, DueFilterMode } from "../assignmentListFilters";

const statusOptions = ["all", "untested", "failed", "blocked", "retest", "passed"] as const;
const dueFilterOptions: Array<{ value: DueFilterMode; label: string }> = [
  { value: "all", label: "Any due date" },
  { value: "unset", label: "No due date" },
  { value: "overdue", label: "Overdue" },
  { value: "due_by", label: "Due on or before" }
];

type Props = {
  filters: AssignmentListFilterState;
  onChange: (patch: Partial<AssignmentListFilterState>) => void;
  runOptions: Array<[string, string]>;
  milestones: MilestoneRow[];
  showAssignee?: boolean;
  assigneeOptions?: Array<{ value: string; label: string }>;
  assigneeValue?: string;
  onAssigneeChange?: (value: string) => void;
  searchPlaceholder?: string;
};

export function buildAssignmentWorkloadFilterFields({
  filters,
  onChange,
  runOptions,
  milestones,
  showAssignee,
  assigneeOptions,
  assigneeValue,
  onAssigneeChange,
  searchPlaceholder = "Search cases or runs"
}: Props): FilterField[] {
  const fields: FilterField[] = [
    {
      kind: "search",
      id: "search",
      label: "Search",
      value: filters.search,
      onChange: (value) => onChange({ search: value }),
      placeholder: searchPlaceholder
    }
  ];

  if (showAssignee && assigneeOptions && onAssigneeChange) {
    fields.push({
      kind: "select",
      id: "assignee",
      label: "Assignee",
      value: assigneeValue ?? "all",
      onChange: onAssigneeChange,
      options: assigneeOptions
    });
  }

  fields.push(
    {
      kind: "select",
      id: "status",
      label: "Status",
      value: filters.status,
      onChange: (value) => onChange({ status: value }),
      options: statusOptions.map((status) => ({ value: status, label: status }))
    },
    {
      kind: "select",
      id: "run",
      label: "Run",
      value: filters.runId,
      onChange: (value) => onChange({ runId: value }),
      options: [{ value: "all", label: "All runs" }, ...runOptions.map(([id, name]) => ({ value: id, label: name }))]
    }
  );

  if (milestones.length > 0) {
    fields.push({
      kind: "select",
      id: "milestone",
      label: "Milestone",
      value: filters.milestoneId,
      onChange: (value) => onChange({ milestoneId: value }),
      options: [
        { value: "all", label: "All milestones" },
        { value: "none", label: "No milestone" },
        ...milestones.map((milestone) => ({ value: String(milestone.id), label: milestone.name }))
      ]
    });
  }

  fields.push({
    kind: "select",
    id: "due",
    label: "Due",
    value: filters.dueFilter,
    onChange: (value) => onChange({ dueFilter: value as DueFilterMode }),
    options: dueFilterOptions
  });

  return fields;
}
