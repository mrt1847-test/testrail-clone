import type { Dispatch, SetStateAction } from "react";
import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import type { TestInstanceRow } from "../types";

type Props = {
  pagedInstances: TestInstanceRow[];
  selectedInstanceId: string | null;
  onSelectInstance: (instance: TestInstanceRow) => void;
  members: ProjectMemberRow[];
  searchText: string;
  onSearchTextChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  selectedTestIds: string[];
  setSelectedTestIds: Dispatch<SetStateAction<string[]>>;
  allFilteredSelected: boolean;
  instanceAssignees: Record<string, string>;
  onInstanceAssigneeChange: (testId: string, value: string) => void;
  onSaveInstanceAssignee: (testId: string) => void;
  isSavingInstanceAssignee: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function RunInstancesSection(props: Props) {
  const {
    pagedInstances,
    selectedInstanceId,
    onSelectInstance,
    members,
    searchText,
    onSearchTextChange,
    statusFilter,
    onStatusFilterChange,
    assigneeFilter,
    onAssigneeFilterChange,
    selectedTestIds,
    setSelectedTestIds,
    allFilteredSelected,
    instanceAssignees,
    onInstanceAssigneeChange,
    onSaveInstanceAssignee,
    isSavingInstanceAssignee,
    page,
    totalPages,
    total,
    onPrevPage,
    onNextPage
  } = props;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <input
          className="min-w-40 flex-1 rounded border border-slate-300 px-2 py-1"
          placeholder="Search case code/title"
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
        />
        <select
          className="rounded border border-slate-300 px-2 py-1"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="all">All status</option>
          <option value="untested">untested</option>
          <option value="passed">passed</option>
          <option value="failed">failed</option>
          <option value="blocked">blocked</option>
          <option value="retest">retest</option>
        </select>
        <select
          className="rounded border border-slate-300 px-2 py-1"
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
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTestIds((prev) => Array.from(new Set([...prev, ...pagedInstances.map((instance) => instance.id)])));
                    return;
                  }
                  const filteredSet = new Set(pagedInstances.map((instance) => instance.id));
                  setSelectedTestIds((prev) => prev.filter((id) => !filteredSet.has(id)));
                }}
              />
            </th>
            <th className="px-3 py-2">Case</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Assignee</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pagedInstances.map((row) => (
            <tr
              key={row.id}
              className={selectedInstanceId === row.id ? "bg-slate-100" : "cursor-pointer hover:bg-slate-50"}
              onClick={() => onSelectInstance(row)}
            >
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedTestIds.includes(row.id)}
                  onChange={(e) =>
                    setSelectedTestIds((prev) =>
                      e.target.checked ? Array.from(new Set([...prev, row.id])) : prev.filter((id) => id !== row.id)
                    )
                  }
                />
              </td>
              <td className="px-3 py-2 font-mono text-xs">{row.caseCode}</td>
              <td className="px-3 py-2">{row.title}</td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <select
                    className="min-w-28 rounded border border-slate-300 px-1 py-1 text-xs"
                    value={instanceAssignees[row.id] ?? ""}
                    onChange={(e) => onInstanceAssigneeChange(row.id, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.userId}>
                        {member.name ?? member.email}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                    disabled={isSavingInstanceAssignee}
                    onClick={() => onSaveInstanceAssignee(row.id)}
                  >
                    Save
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <p>
          page {page} / {totalPages} · total {total}
        </p>
        <div className="flex gap-2">
          <button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50" disabled={page <= 1} onClick={onPrevPage}>
            Prev
          </button>
          <button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={onNextPage}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
