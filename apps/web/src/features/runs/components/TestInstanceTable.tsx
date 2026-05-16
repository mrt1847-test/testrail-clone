import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { TestInstanceRow } from "../types";
import { DefectKeyInput } from "./DefectKeyInput";
import { useProjectStatuses } from "../hooks/useProjectStatuses";
import type { ProjectStatusOption } from "../utils/projectStatuses";
import { StatusPicker, pickDefaultStatusOption } from "./StatusPicker";
import type { ResultStatus } from "./resultEntryTypes";
import { StatusBadge } from "../../../shared/ui/StatusBadge";
import { normalizeElapsedInput } from "./resultEntryUtils";

type Props = {
  projectId: string;
  pagedInstances: TestInstanceRow[];
  selectedInstanceId: string | null;
  onSelectInstance: (instance: TestInstanceRow) => void;
  selectedTestIds: string[];
  setSelectedTestIds: Dispatch<SetStateAction<string[]>>;
  allFilteredSelected: boolean;
  onQuickResultSave: (
    testId: string,
    payload: { status: ResultStatus; comment?: string; elapsed?: string; version?: string; defects?: string[] }
  ) => void;
  isSavingQuickResult: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  subscribedTestIds?: Set<string>;
  onToggleSubscribe?: (testId: string, subscribed: boolean) => void;
  isSubscribePending?: boolean;
};

export function TestInstanceTable(props: Props) {
  const {
    projectId,
    pagedInstances,
    selectedInstanceId,
    onSelectInstance,
    selectedTestIds,
    setSelectedTestIds,
    allFilteredSelected,
    onQuickResultSave,
    isSavingQuickResult,
    page,
    totalPages,
    total,
    onPrevPage,
    onNextPage,
    subscribedTestIds,
    onToggleSubscribe,
    isSubscribePending
  } = props;
  const [editingRow, setEditingRow] = useState<TestInstanceRow | null>(null);
  const statusQuery = useProjectStatuses(projectId);
  const statusOptions = statusQuery.data ?? [];
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatusOption | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [draftElapsed, setDraftElapsed] = useState("");
  const [draftElapsedError, setDraftElapsedError] = useState("");
  const [draftVersion, setDraftVersion] = useState("");
  const [draftDefects, setDraftDefects] = useState<string[]>([]);
  useEffect(() => {
    if (!editingRow) return;
    const match =
      statusOptions.find((option) => option.canonicalStatus === editingRow.status) ??
      pickDefaultStatusOption(statusOptions, editingRow.status as ResultStatus);
    setSelectedStatus(match);
    setDraftComment("");
    setDraftElapsed("");
    setDraftElapsedError("");
    setDraftVersion("");
    setDraftDefects([]);
  }, [editingRow, statusOptions]);

  const activeStatus = selectedStatus ?? pickDefaultStatusOption(statusOptions);
  const disableUntested = editingRow != null && editingRow.status !== "untested";

  function closeEditor() {
    if (isSavingQuickResult) return;
    setEditingRow(null);
  }

  function saveDraft() {
    if (!editingRow) return;
    const normalizedElapsed = normalizeElapsedInput(draftElapsed);
    setDraftElapsedError(normalizedElapsed.error ?? "");
    if (normalizedElapsed.error) return;
    onQuickResultSave(editingRow.id, {
      status: activeStatus.canonicalStatus,
      comment: draftComment.trim() || undefined,
      elapsed: normalizedElapsed.value,
      version: draftVersion.trim() || undefined,
      defects: draftDefects
    });
    setEditingRow(null);
  }

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
              <th className="w-36 px-3 py-2.5" scope="col">
                Status
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
                <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                  <StatusBadge
                    status={row.status}
                    interactive
                    onClick={() => setEditingRow(row)}
                  />
                </td>
                {onToggleSubscribe ? (
                  <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={isSubscribePending}
                      title={subscribedTestIds?.has(row.id) ? "Unsubscribe from email updates" : "Subscribe to email updates"}
                      className={`text-xs font-medium underline disabled:opacity-50 ${
                        subscribedTestIds?.has(row.id) ? "text-indigo-700" : "text-slate-600"
                      }`}
                      onClick={() => onToggleSubscribe(row.id, !subscribedTestIds?.has(row.id))}
                    >
                      {subscribedTestIds?.has(row.id) ? "Watching" : "Watch"}
                    </button>
                  </td>
                ) : null}
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
      {editingRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4" onClick={closeEditor}>
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-500">{editingRow.caseCode}</p>
                <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">{editingRow.title}</h3>
              </div>
              <button type="button" className="text-xl leading-none text-slate-400 hover:text-slate-700" onClick={closeEditor}>
                x
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <StatusPicker
                options={statusOptions}
                selectedId={activeStatus.id}
                disableUntested={disableUntested}
                onSelect={setSelectedStatus}
              />

              <label className="block text-xs font-medium text-slate-600">
                Comment
                <textarea
                  className="mt-1 min-h-24 w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-600">
                  Elapsed
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
                    placeholder="e.g. 3m 20s"
                    value={draftElapsed}
                    onBlur={() => {
                      const normalized = normalizeElapsedInput(draftElapsed);
                      setDraftElapsedError(normalized.error ?? "");
                      if (normalized.value) setDraftElapsed(normalized.value);
                    }}
                    onChange={(e) => {
                      setDraftElapsed(e.target.value);
                      if (draftElapsedError) setDraftElapsedError("");
                    }}
                  />
                  {draftElapsedError ? <span className="mt-1 block text-xs text-red-600">{draftElapsedError}</span> : null}
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Version
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500"
                    value={draftVersion}
                    onChange={(e) => setDraftVersion(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">Defects</p>
                <DefectKeyInput defects={draftDefects} onChange={setDraftDefects} />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700" onClick={closeEditor}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  disabled={isSavingQuickResult}
                  onClick={saveDraft}
                >
                  {isSavingQuickResult ? "Saving..." : "Add result"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
