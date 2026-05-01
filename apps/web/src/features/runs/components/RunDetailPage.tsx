import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { fetchMilestone, fetchProjectMembers } from "../../projects/api/advancedApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { addRunResult } from "../api/runApi";
import type { TestInstanceRow } from "../types";
import {
  useAddResultAttachmentMutation,
  useAddResultDefectMutation,
  useAddRunResultMutation,
  useCloseRunMutation,
  useRerunMutation,
  useResultAttachmentsQuery,
  useResultDefectsQuery,
  useResultStepsQuery,
  useRunDetailQuery,
  useRunInstancesQuery,
  useTestResultsQuery,
  useDeleteAttachmentMutation,
  useOpenAttachmentDownloadMutation,
  usePushResultDefectMutation,
  useDeleteResultDefectMutation,
  useUpdateTestAssigneeMutation,
  useUpdateRunAssigneeMutation
} from "../hooks/useRunsApi";
import { CloseRunDialog } from "./CloseRunDialog";
import { ResultEntryPanel } from "./ResultEntryPanel";
import { ResultHistoryList } from "./ResultHistoryList";

export function RunDetailPage() {
  const { projectId = "", runId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useRunDetailQuery(projectId, runId);
  const milestoneId = data?.run.milestoneId ?? null;
  const [selected, setSelected] = useState<TestInstanceRow | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [instancePage, setInstancePage] = useState(1);
  const instancePageSize = 50;
  const [instanceAssignees, setInstanceAssignees] = useState<Record<string, string>>({});
  const [closeRunDialogOpen, setCloseRunDialogOpen] = useState(false);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<"passed" | "failed" | "blocked" | "retest" | "untested">("passed");
  const [bulkComment, setBulkComment] = useState("");
  const [rerunDialogOpen, setRerunDialogOpen] = useState(false);
  const [rerunSelectedStatuses, setRerunSelectedStatuses] = useState<Array<"failed" | "blocked" | "retest">>(["failed"]);
  const { data: history = [], isLoading: isHistoryLoading } = useTestResultsQuery(selected?.id);
  const { data: steps = [], isLoading: isStepsLoading } = useResultStepsQuery(selectedResultId ?? undefined);
  const { data: attachments = [], isLoading: isAttachmentsLoading } = useResultAttachmentsQuery(selectedResultId ?? undefined);
  const { data: defects = [], isLoading: isDefectsLoading } = useResultDefectsQuery(selectedResultId ?? undefined);
  const qc = useQueryClient();
  const membersQuery = useQuery({
    queryKey: ["run-assignee-members", projectId],
    queryFn: () => fetchProjectMembers(projectId),
    enabled: Boolean(projectId)
  });
  const milestoneQuery = useQuery({
    queryKey: ["run-detail-milestone", projectId, milestoneId ?? ""],
    queryFn: () => fetchMilestone(projectId, milestoneId ?? ""),
    enabled: Boolean(projectId && milestoneId)
  });
  const addResultMutation = useAddRunResultMutation(projectId, runId);
  const closeRunMutation = useCloseRunMutation(projectId, runId);
  const assigneeMutation = useUpdateRunAssigneeMutation(projectId, runId);
  const testAssigneeMutation = useUpdateTestAssigneeMutation(projectId, runId);
  const rerunMutation = useRerunMutation(projectId, runId);
  const addAttachmentMutation = useAddResultAttachmentMutation(selectedResultId ?? undefined);
  const openAttachmentDownloadMutation = useOpenAttachmentDownloadMutation();
  const deleteAttachmentMutation = useDeleteAttachmentMutation(selectedResultId ?? undefined);
  const addDefectMutation = useAddResultDefectMutation(selectedResultId ?? undefined);
  const pushDefectMutation = usePushResultDefectMutation(selectedResultId ?? undefined);
  const deleteDefectMutation = useDeleteResultDefectMutation(selectedResultId ?? undefined);
  const runInstancesQuery = useRunInstancesQuery({
    projectId,
    runId,
    page: instancePage,
    pageSize: instancePageSize,
    status: statusFilter,
    assignee: assigneeFilter,
    search: searchText
  });
  const bulkResultMutation = useMutation({
    mutationFn: async () => {
      const targets = selectedTestIds;
      await Promise.all(
        targets.map((testId) =>
          addRunResult({
            runId,
            testId,
            status: bulkStatus,
            comment: bulkComment.trim() || undefined
          })
        )
      );
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["runs", projectId, "detail", runId] }),
        qc.invalidateQueries({ queryKey: ["runs", projectId, "instances", runId] }),
        qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) }),
        qc.invalidateQueries({ queryKey: reportKeys.all(projectId) }),
        qc.invalidateQueries({ queryKey: ["result-explorer", projectId] })
      ]);
      setBulkComment("");
      setSelectedTestIds([]);
    }
  });

  if (isLoading) return <LoadingState message="Loading run…" />;
  if (isError || !data) return <ErrorState title="Run not found" onRetry={() => refetch()} />;

  const { run, counts } = data;
  const pagedInstances: TestInstanceRow[] = (runInstancesQuery.data?.data ?? []).map((i) => ({
    id: String(i.id),
    caseCode: `C${i.caseId}`,
    title: i.titleSnapshot,
    status: i.status,
    assignedTo: i.assignedTo ? String(i.assignedTo) : null
  }));

  useEffect(() => {
    setSelectedResultId(null);
  }, [selected?.id]);

  useEffect(() => {
    setAssigneeInput(run.assignedTo ?? "");
  }, [run.assignedTo]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const instance of pagedInstances) {
      next[instance.id] = instance.assignedTo ?? "";
    }
    setInstanceAssignees(next);
  }, [pagedInstances]);

  const untestedCount = counts.untested ?? 0;
  const allFilteredSelected =
    pagedInstances.length > 0 && pagedInstances.every((row) => selectedTestIds.includes(row.id));
  const canBulkSubmit = selectedTestIds.length > 0 && !bulkResultMutation.isPending;
  const pushedDefectMessage = pushDefectMutation.data
    ? `Pushed ${pushDefectMutation.data.defectKey}${pushDefectMutation.data.url ? ` (${pushDefectMutation.data.url})` : ""}`
    : null;
  const rerunStatuses = useMemo(
    () => rerunSelectedStatuses as Array<"passed" | "failed" | "blocked" | "retest" | "untested">,
    [rerunSelectedStatuses]
  );

  return (
    <div className="space-y-4">
      <CloseRunDialog
        open={closeRunDialogOpen}
        runName={run.name}
        untestedCount={untestedCount}
        isPending={closeRunMutation.isPending}
        onCancel={() => setCloseRunDialogOpen(false)}
        onConfirm={async () => {
          await closeRunMutation.mutateAsync();
          setCloseRunDialogOpen(false);
        }}
      />
      <ConfirmDialog
        open={rerunDialogOpen}
        title="Create rerun run"
        description={
          <div className="space-y-2 text-sm">
            <p className="text-slate-600">선택한 상태의 테스트 인스턴스로 새 rerun을 생성합니다.</p>
            <div className="flex flex-wrap gap-2">
              {(["failed", "blocked", "retest"] as const).map((status) => (
                <label key={status} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={rerunSelectedStatuses.includes(status)}
                    onChange={(e) =>
                      setRerunSelectedStatuses((prev) =>
                        e.target.checked ? Array.from(new Set([...prev, status])) : prev.filter((item) => item !== status)
                      )
                    }
                  />
                  {status}
                </label>
              ))}
            </div>
          </div>
        }
        confirmLabel={rerunMutation.isPending ? "Creating…" : "Create rerun"}
        confirmDisabled={rerunMutation.isPending || rerunSelectedStatuses.length === 0}
        cancelLabel="Cancel"
        onCancel={() => setRerunDialogOpen(false)}
        onConfirm={async () => {
          await rerunMutation.mutateAsync(rerunStatuses);
          setRerunDialogOpen(false);
        }}
      />
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase text-slate-500">Run</p>
        <h2 className="text-xl font-semibold text-slate-900">{run.name}</h2>
        <p className="text-sm text-slate-600">
          {run.status} {run.environment ? `· ${run.environment}` : ""}
        </p>
        {run.milestoneId ? (
          <p className="text-xs text-slate-500">
            milestone: {milestoneQuery.data?.name ?? `#${run.milestoneId}`}
          </p>
        ) : null}
        <p className="text-xs text-slate-500">assignee: {run.assignedTo ?? "unassigned"}</p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-900">Passed {counts.passed}</span>
        <span className="rounded-md bg-red-50 px-2 py-1 text-red-900">Failed {counts.failed}</span>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">Blocked {counts.blocked}</span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-800">Retest {counts.retest}</span>
        <span className="rounded-md bg-slate-50 px-2 py-1 text-slate-700">Untested {counts.untested}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <input
              className="min-w-40 flex-1 rounded border border-slate-300 px-2 py-1"
              placeholder="Search case code/title"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setInstancePage(1);
              }}
            />
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setInstancePage(1);
              }}
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
              onChange={(e) => {
                setAssigneeFilter(e.target.value);
                setInstancePage(1);
              }}
            >
              <option value="all">All assignees</option>
              <option value="">Unassigned</option>
              {(membersQuery.data ?? []).map((member) => (
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
                        setSelectedTestIds((prev) => Array.from(new Set([...prev, ...pagedInstances.map((i) => i.id)])));
                      } else {
                        const filteredSet = new Set(pagedInstances.map((i) => i.id));
                        setSelectedTestIds((prev) => prev.filter((id) => !filteredSet.has(id)));
                      }
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
                  className={selected?.id === row.id ? "bg-slate-100" : "cursor-pointer hover:bg-slate-50"}
                  onClick={() => setSelected(row)}
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
                        onChange={(e) =>
                          setInstanceAssignees((prev) => ({
                            ...prev,
                            [row.id]: e.target.value
                          }))
                        }
                      >
                        <option value="">Unassigned</option>
                        {(membersQuery.data ?? []).map((member) => (
                          <option key={member.id} value={member.userId}>
                            {member.name ?? member.email}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={testAssigneeMutation.isPending}
                        onClick={() =>
                          void testAssigneeMutation.mutateAsync({
                            testId: row.id,
                            assignedTo: (instanceAssignees[row.id] ?? "").trim() || null
                          })
                        }
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
              page {runInstancesQuery.data?.page ?? instancePage} / {runInstancesQuery.data?.totalPages ?? 1} · total{" "}
              {runInstancesQuery.data?.total ?? 0}
            </p>
            <div className="flex gap-2">
              <button
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                disabled={instancePage <= 1}
                onClick={() => setInstancePage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                disabled={instancePage >= (runInstancesQuery.data?.totalPages ?? 1)}
                onClick={() =>
                  setInstancePage((p) => Math.min(runInstancesQuery.data?.totalPages ?? 1, p + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Result entry</h3>
          {selected ? (
            <div className="mt-3 space-y-4 text-sm text-slate-700">
              <ResultEntryPanel
                key={selected.id}
                projectId={projectId}
                instance={{
                  id: selected.id,
                  caseCode: selected.caseCode,
                  title: selected.title
                }}
                isSubmitting={addResultMutation.isPending}
                onSubmit={(payload) => {
                  void addResultMutation.mutateAsync({
                    testId: selected.id,
                    status: payload.status,
                    comment: payload.comment,
                    elapsed: payload.elapsed,
                    version: payload.version,
                    defects: payload.defects,
                    customValues: payload.customValues,
                    stepResults: payload.stepResults
                  });
                }}
              />
              <ResultHistoryList
                history={history}
                isHistoryLoading={isHistoryLoading}
                selectedResultId={selectedResultId}
                onSelectResult={setSelectedResultId}
                steps={steps}
                isStepsLoading={isStepsLoading}
                attachments={attachments}
                isAttachmentsLoading={isAttachmentsLoading}
                defects={defects}
                isDefectsLoading={isDefectsLoading}
                isAddingAttachment={addAttachmentMutation.isPending}
                isOpeningAttachmentDownload={openAttachmentDownloadMutation.isPending}
                isDeletingAttachment={deleteAttachmentMutation.isPending}
                isAddingDefect={addDefectMutation.isPending}
                isPushingDefect={pushDefectMutation.isPending}
                isDeletingDefect={deleteDefectMutation.isPending}
                pushedDefectMessage={pushedDefectMessage}
                onAddAttachment={(file) => void addAttachmentMutation.mutateAsync(file)}
                onOpenAttachmentDownload={(attachmentId) =>
                  void openAttachmentDownloadMutation.mutateAsync(attachmentId)
                }
                onDeleteAttachment={(attachmentId) => void deleteAttachmentMutation.mutateAsync(attachmentId)}
                onAddDefect={(input) => void addDefectMutation.mutateAsync(input)}
                onPushDefect={(input) => void pushDefectMutation.mutateAsync(input)}
                onDeleteDefect={(defectLinkId) => void deleteDefectMutation.mutateAsync(defectLinkId)}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Select a test instance to enter results.</p>
          )}

          <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run actions</h4>
            <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
              <p className="mb-2 font-medium text-slate-700">Bulk manual result entry</p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    className="rounded border border-slate-300 px-2 py-1"
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as typeof bulkStatus)}
                  >
                    <option value="passed">passed</option>
                    <option value="failed">failed</option>
                    <option value="blocked">blocked</option>
                    <option value="retest">retest</option>
                    <option value="untested">untested</option>
                  </select>
                  <input
                    className="flex-1 rounded border border-slate-300 px-2 py-1"
                    placeholder="comment (optional)"
                    value={bulkComment}
                    onChange={(e) => setBulkComment(e.target.value)}
                  />
                </div>
                <button
                  className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                  disabled={!canBulkSubmit}
                  onClick={() => void bulkResultMutation.mutateAsync()}
                >
                  {bulkResultMutation.isPending ? "Applying…" : `Apply to selected (${selectedTestIds.length})`}
                </button>
              </div>
            </div>
            <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded border border-slate-300 px-2 py-1"
                  value={assigneeInput}
                  onChange={(e) => setAssigneeInput(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {(membersQuery.data ?? []).map((member) => (
                    <option key={member.id} value={member.userId}>
                      {member.name ?? member.email} ({member.role})
                    </option>
                  ))}
                </select>
                <button
                  className="rounded border border-slate-300 px-2 py-1"
                  disabled={assigneeMutation.isPending}
                  onClick={() => void assigneeMutation.mutateAsync(assigneeInput.trim() || null)}
                >
                  Assign
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                disabled={rerunMutation.isPending}
                onClick={() => setRerunDialogOpen(true)}
              >
                Rerun…
              </button>
              <button
                type="button"
                className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                disabled={run.status === "closed" || closeRunMutation.isPending}
                onClick={() => setCloseRunDialogOpen(true)}
              >
                Close run
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
