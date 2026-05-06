import type { ProjectMemberRow } from "../../projects/api/settingsApi";

type Props = {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  members: ProjectMemberRow[];
};

export function TestInstanceFilterBar({
  searchText,
  onSearchTextChange,
  statusFilter,
  onStatusFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  members
}: Props) {
  return (
    <div
      className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-end"
      role="search"
      aria-label="Filter test instances"
    >
      <label className="flex min-w-[12rem] flex-1 flex-col gap-0.5 text-xs font-medium text-slate-600">
        Search
        <input
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-900"
          placeholder="Case code or title"
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
        />
      </label>
      <label className="flex w-full flex-col gap-0.5 text-xs font-medium text-slate-600 sm:w-36">
        Status
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="all">All</option>
          <option value="untested">Untested</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="blocked">Blocked</option>
          <option value="retest">Retest</option>
        </select>
      </label>
      <label className="flex w-full flex-col gap-0.5 text-xs font-medium text-slate-600 sm:w-44">
        Assignee
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"
          value={assigneeFilter}
          onChange={(e) => onAssigneeFilterChange(e.target.value)}
        >
          <option value="all">All assignees</option>
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.userId}>
              {member.name ?? member.email}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
