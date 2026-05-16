import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import { FilterBar, type FilterField } from "../../../shared/ui/FilterBar";

type Props = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  members: ProjectMemberRow[];
  hideStatusFilter?: boolean;
};

export function TestInstanceFilterBar({
  searchText,
  onSearchTextChange,
  statusFilter,
  onStatusFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  members,
  hideStatusFilter = false
}: Props) {
  const fields: FilterField[] = [
    {
      kind: "search",
      id: "q",
      label: "Search",
      value: searchText,
      onChange: onSearchTextChange,
      placeholder: "Case code or title"
    },
    ...(hideStatusFilter
      ? []
      : [
          {
            kind: "select" as const,
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: onStatusFilterChange,
            options: [
              { value: "all", label: "All" },
              { value: "untested", label: "Untested" },
              { value: "passed", label: "Passed" },
              { value: "failed", label: "Failed" },
              { value: "blocked", label: "Blocked" },
              { value: "retest", label: "Retest" }
            ]
          }
        ]),
    {
      kind: "select",
      id: "assignee",
      label: "Assignee",
      value: assigneeFilter,
      onChange: onAssigneeFilterChange,
      options: [
        { value: "all", label: "All assignees" },
        { value: "", label: "Unassigned" },
        ...members.map((member) => ({
          value: member.userId,
          label: member.name ?? member.email
        }))
      ]
    }
  ];

  return <FilterBar fields={fields} ariaLabel="Filter test instances" variant="toolbar" />;
}
