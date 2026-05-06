import type { Dispatch, SetStateAction } from "react";
import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import type { TestInstanceRow } from "../types";

function statusTone(status: string): string {
  switch (status) {
    case "passed":
      return "bg-emerald-50 text-emerald-900 ring-emerald-100";
    case "failed":
      return "bg-red-50 text-red-900 ring-red-100";
    case "blocked":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    case "retest":
      return "bg-violet-50 text-violet-900 ring-violet-100";
    case "untested":
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

type Props = {
  pagedInstances: TestInstanceRow[];
  selectedInstanceId: string | null;
  onSelectInstance: (instance: TestInstanceRow) => void;
  members: ProjectMemberRow[];
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

export function TestInstanceTable(props: Props) {
  const {
    pagedInstances,
    selectedInstanceId,
    onSelectInstance,
    members,
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
    <>
      <div className="max-h-[min(70vh,720px)] overflow-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-600 shadow-[0_1px_0_0_rgb(226_232_240)]">
            <tr>
              <th className="w-10 px-3 py-2.5" scope="col">
                <span className="sr-only">Select row for bulk actions</span>
                <input
                  type="checkbox"
                  title="Select all on this page"
                  checked={allFilteredSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTestIds((prev) =>
                        Array.from(new Set([...prev, ...pagedInstances.map((instance) => instance.id)]))
                      );
                      return;
                    }
                    const filteredSet = new Set(pagedInstances.map((instance) => instance.id));
                    setSelectedTestIds((prev) => prev.filter((id) => !filteredSet.has(id)));
                  }}
                />
              </th>
              <th className="px-3 py-2.5" scope="col">
                Case
              </th>
              <th className="min-w-[8rem] px-3 py-2.5" scope="col">
                Title
              </th>
              <th className="px-3 py-2.5" scope="col">
                Status
              </th>
              <th className="min-w-[12rem] px-3 py-2.5" scope="col">
                Assignee
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pagedInstances.map((row) => (
              <tr
                key={row.id}
                className={
                  selectedInstanceId === row.id
                    ? "bg-sky-50/80 hover:bg-sky-50"
                    : "cursor-pointer hover:bg-slate-50/90"
                }
                onClick={() => onSelectInstance(row)}
              >
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
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
                <td className="px-3 py-2 align-middle font-mono text-xs text-slate-800">{row.caseCode}</td>
                <td className="max-w-[24rem] truncate px-3 py-2 align-middle text-slate-800" title={row.title}>
                  {row.title}
                </td>
                <td className="px-3 py-2 align-middle">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusTone(row.status)}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap items-center gap-1">
                    <select
                      className="min-w-[7rem] max-w-[10rem] rounded border border-slate-300 bg-white px-1 py-1 text-xs"
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
                      type="button"
                      className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
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
      </div>
      <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Page <span className="font-medium text-slate-800">{page}</span> of {totalPages}
          <span className="mx-1 text-slate-300">·</span>
          <span className="font-medium text-slate-800">{total}</span> tests match filters
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 disabled:opacity-50"
            disabled={page <= 1}
            onClick={onPrevPage}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={onNextPage}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
