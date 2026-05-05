import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import type { TestInstanceRow } from "../types";
import { useRunBulkActions } from "../hooks/useRunBulkActions";
import { useRunDetailQueries } from "../hooks/useRunDetailQueries";
import { useRunUrlState } from "../hooks/useRunUrlState";
import {
  useAddResultAttachmentMutation,
  useAddResultDefectMutation,
  useAddRunResultMutation,
  useCloseRunMutation,
  useReopenRunMutation,
  useAddCasesToRunMutation,
  useRemoveTestFromRunMutation,
  useDeleteAttachmentMutation,
  useDeleteResultDefectMutation,
  useOpenAttachmentDownloadMutation,
  usePushResultDefectMutation,
  useRerunMutation,
  useUpdateRunAssigneeMutation,
  useUpdateTestAssigneeMutation
} from "../hooks/useRunsApi";
import { CloseRunDialog } from "./CloseRunDialog";
import { RunActionsPanel } from "./RunActionsPanel";
import { RunDetailSummarySection } from "./RunDetailSummarySection";
import { RunInstancesSection } from "./RunInstancesSection";
import { ResultEntryPanel } from "./ResultEntryPanel";
import { ResultHistoryList } from "./ResultHistoryList";

export function RunDetailPage() {
  const { projectId = "", runId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<TestInstanceRow | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [instanceAssignees, setInstanceAssignees] = useState<Record<string, string>>({});
  const [closeRunDialogOpen, setCloseRunDialogOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 15;
  const [addCasesInput, setAddCasesInput] = useState("");
  const [rerunDialogOpen, setRerunDialogOpen] = useState(false);
  const [rerunSelectedStatuses, setRerunSelectedStatuses] = useState<Array<"failed" | "blocked" | "retest">>(["failed"]);
  const instancePageSize = 50;
  const selectedCaseId = selected?.caseId ? Number(selected.caseId) : null;
  const urlState = useRunUrlState({
    searchParams,
    setSearchParams,
    selectedTestId: selected?.id ?? null
  });
  const { statusFilter, setStatusFilter, assigneeFilter, setAssigneeFilter, searchText, setSearchText, instancePage, setInstancePage } =
    urlState;

  const queries =   useRunDetailQueries({
    projectId,
    runId,
    selectedCaseId,
    selectedTestId: selected?.id,
    selectedResultId,
    instancePage,
    pageSize: instancePageSize,
    historyPage,
    historyPageSize,
    statusFilter,
    assigneeFilter,
    searchText
  });
  const {
    runDetailQuery,
    membersQuery,
    milestoneQuery,
    runInstancesQuery,
    pagedInstances,
    selectedCaseDetail,
    historyQuery,
    stepsQuery,
    attachmentsQuery,
    defectsQuery
  } = queries;
  const bulkActions = useRunBulkActions({ projectId, runId, pagedInstances });
  const { selectedTestIds, setSelectedTestIds, bulkStatus, setBulkStatus, bulkComment, setBulkComment, bulkResultMutation, allFilteredSelected, canBulkSubmit, selectedCount } =
    bulkActions;

  const addResultMutation = useAddRunResultMutation(projectId, runId);
  const closeRunMutation = useCloseRunMutation(projectId, runId);
  const reopenRunMutation = useReopenRunMutation(projectId, runId);
  const addCasesMutation = useAddCasesToRunMutation(projectId, runId);
  const removeTestMutation = useRemoveTestFromRunMutation(projectId, runId);
  const assigneeMutation = useUpdateRunAssigneeMutation(projectId, runId);
  const testAssigneeMutation = useUpdateTestAssigneeMutation(projectId, runId);
  const rerunMutation = useRerunMutation(projectId, runId);
  const addAttachmentMutation = useAddResultAttachmentMutation(selectedResultId ?? undefined);
  const openAttachmentDownloadMutation = useOpenAttachmentDownloadMutation();
  const deleteAttachmentMutation = useDeleteAttachmentMutation(selectedResultId ?? undefined);
  const addDefectMutation = useAddResultDefectMutation(selectedResultId ?? undefined);
  const pushDefectMutation = usePushResultDefectMutation(selectedResultId ?? undefined);
  const deleteDefectMutation = useDeleteResultDefectMutation(selectedResultId ?? undefined);
  const run = runDetailQuery.data?.run;
  const counts = runDetailQuery.data?.counts ?? { passed: 0, failed: 0, blocked: 0, retest: 0, untested: 0 };

  useEffect(() => {
    const selectedTestId = searchParams.get("testId");
    if (!selectedTestId) return;
    if (selected?.id === selectedTestId) return;
    const matched = pagedInstances.find((row) => row.id === selectedTestId);
    if (matched) setSelected(matched);
  }, [pagedInstances, searchParams, selected?.id]);

  useEffect(() => {
    setSelectedResultId(null);
    setHistoryPage(1);
  }, [selected?.id]);

  useEffect(() => {
    setAssigneeInput(run?.assignedTo ?? "");
  }, [run?.assignedTo]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const instance of pagedInstances) {
      next[instance.id] = instance.assignedTo ?? "";
    }
    setInstanceAssignees(next);
  }, [pagedInstances]);

  if (runDetailQuery.isLoading) return <LoadingState message="Loading run..." />;
  if (runDetailQuery.isError || !runDetailQuery.data || !run) {
    return <ErrorState title="Run not found" onRetry={() => runDetailQuery.refetch()} />;
  }

  const untestedCount = counts.untested ?? 0;
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

      <RunDetailSummarySection run={run} counts={counts} milestoneName={milestoneQuery.data?.name} />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <RunInstancesSection
          pagedInstances={pagedInstances}
          selectedInstanceId={selected?.id ?? null}
          onSelectInstance={setSelected}
          members={membersQuery.data ?? []}
          searchText={searchText}
          onSearchTextChange={(value) => {
            setSearchText(value);
            setInstancePage(1);
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            setInstancePage(1);
          }}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={(value) => {
            setAssigneeFilter(value);
            setInstancePage(1);
          }}
          selectedTestIds={selectedTestIds}
          setSelectedTestIds={setSelectedTestIds}
          allFilteredSelected={allFilteredSelected}
          instanceAssignees={instanceAssignees}
          onInstanceAssigneeChange={(testId, value) =>
            setInstanceAssignees((prev) => ({
              ...prev,
              [testId]: value
            }))
          }
          onSaveInstanceAssignee={(testId) =>
            void testAssigneeMutation.mutateAsync({
              testId,
              assignedTo: (instanceAssignees[testId] ?? "").trim() || null
            })
          }
          isSavingInstanceAssignee={testAssigneeMutation.isPending}
          page={runInstancesQuery.data?.page ?? instancePage}
          totalPages={runInstancesQuery.data?.totalPages ?? 1}
          total={runInstancesQuery.data?.total ?? 0}
          onPrevPage={() => setInstancePage((p) => Math.max(1, p - 1))}
          onNextPage={() => setInstancePage((p) => Math.min(runInstancesQuery.data?.totalPages ?? 1, p + 1))}
        />

        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Result entry</h3>
          {selected ? (
            <div className="mt-3 space-y-4 text-sm text-slate-700">
              <ResultEntryPanel
                key={selected.id}
                projectId={projectId}
                instance={{
                  id: selected.id,
                  caseId: selected.caseId,
                  caseCode: selected.caseCode,
                  title: selected.title
                }}
                caseSteps={selectedCaseDetail.data?.steps ?? []}
                isCaseStepsLoading={selectedCaseDetail.isLoading}
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
                history={historyQuery.data?.items ?? []}
                historyTotal={historyQuery.data?.total ?? 0}
                historyPage={historyPage}
                historyTotalPages={historyQuery.data?.totalPages ?? 1}
                onHistoryPageChange={setHistoryPage}
                isHistoryLoading={historyQuery.isLoading}
                selectedResultId={selectedResultId}
                onSelectResult={setSelectedResultId}
                steps={stepsQuery.data ?? []}
                isStepsLoading={stepsQuery.isLoading}
                attachments={attachmentsQuery.data ?? []}
                isAttachmentsLoading={attachmentsQuery.isLoading}
                defects={defectsQuery.data ?? []}
                isDefectsLoading={defectsQuery.isLoading}
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
              {run.status === "open" ? (
                <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">Run composition</p>
                  <p className="mt-1 text-slate-500">케이스 ID를 쉼표로 구분해 오픈 런에 추가합니다.</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1"
                      placeholder="예: 101, 102"
                      value={addCasesInput}
                      onChange={(e) => setAddCasesInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                      disabled={addCasesMutation.isPending}
                      onClick={() => {
                        const ids = addCasesInput
                          .split(/[,\s]+/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        if (ids.length === 0) return;
                        void addCasesMutation.mutateAsync(ids).then(() => setAddCasesInput(""));
                      }}
                    >
                      {addCasesMutation.isPending ? "Adding…" : "Add cases"}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-rose-700 underline disabled:opacity-50"
                    disabled={!selected || removeTestMutation.isPending}
                    onClick={() => {
                      if (!selected) return;
                      void removeTestMutation.mutateAsync({ testId: selected.id });
                    }}
                  >
                    Remove selected test (no results)
                  </button>
                  <button
                    type="button"
                    className="mt-1 block text-rose-800 underline disabled:opacity-50"
                    disabled={!selected || removeTestMutation.isPending}
                    onClick={() => {
                      if (!selected) return;
                      if (!window.confirm("이 테스트의 모든 결과 이력이 삭제됩니다. 계속할까요?")) return;
                      void removeTestMutation.mutateAsync({ testId: selected.id, confirmDataLoss: true });
                    }}
                  >
                    Remove selected test (delete results)
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Select a test instance to enter results.</p>
          )}

          <RunActionsPanel
            members={membersQuery.data ?? []}
            bulkStatus={bulkStatus}
            onBulkStatusChange={setBulkStatus}
            bulkComment={bulkComment}
            onBulkCommentChange={setBulkComment}
            canBulkSubmit={canBulkSubmit}
            isBulkPending={bulkResultMutation.isPending}
            selectedCount={selectedCount}
            onBulkSubmit={() => void bulkResultMutation.mutateAsync()}
            assigneeInput={assigneeInput}
            onAssigneeInputChange={setAssigneeInput}
            isAssignPending={assigneeMutation.isPending}
            onAssignRun={() => void assigneeMutation.mutateAsync(assigneeInput.trim() || null)}
            isRerunPending={rerunMutation.isPending}
            onOpenRerunDialog={() => setRerunDialogOpen(true)}
            canCloseRun={run.status !== "closed"}
            isCloseRunPending={closeRunMutation.isPending}
            onOpenCloseRunDialog={() => setCloseRunDialogOpen(true)}
            canReopenRun={run.status === "closed"}
            isReopenRunPending={reopenRunMutation.isPending}
            onReopenRun={() => void reopenRunMutation.mutateAsync()}
          />
        </aside>
      </div>
    </div>
  );
}
