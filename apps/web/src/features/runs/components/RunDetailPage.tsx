import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { fetchCaseScenarios } from "../../cases/api/bddApi";
import { fetchCaseTemplates } from "../../projects/api/settingsApi";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { CollapsibleSection } from "../../../shared/ui/CollapsibleSection";
import { KeyboardShortcutsDialog } from "../../../shared/ui/KeyboardShortcutsDialog";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import type { TestInstanceRow } from "../types";
import { useRunBulkActions } from "../hooks/useRunBulkActions";
import { useRunDetailQueries } from "../hooks/useRunDetailQueries";
import { useProjectStatuses } from "../hooks/useProjectStatuses";
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
  useUpdateRunScheduleMutation,
  useSyncRunCompositionMutation,
  useUpdateRunCompositionMutation,
  useRunTestSubscriptionsQuery,
  useTestSubscriptionMutation,
} from "../hooks/useRunsApi";
import type { RunCompositionInfo } from "../types";
import { CloseRunDialog } from "./CloseRunDialog";
import { RunActionsPanel } from "./RunActionsPanel";
import { RunHeader } from "./RunHeader";
import { RunSummaryBar } from "./RunSummaryBar";
import { RunDetailSidebar } from "./RunDetailSidebar";
import { RunExecutionToolbar } from "./RunExecutionToolbar";
import { RunInstancesSection } from "./RunInstancesSection";
import { RUN_DETAIL_SHORTCUTS, useRunKeyboardShortcuts } from "../hooks/useRunKeyboardShortcuts";
import { useRunTestNavigation } from "../hooks/useRunTestNavigation";
import { ResultEntryPanel } from "./ResultEntryPanel";
import { ResultHistoryList } from "./ResultHistoryList";
import { RunCompositionPanel, type CompositionFeedback } from "./RunCompositionPanel";
import { RunSchedulePanel } from "./RunSchedulePanel";
import { ExecutionCommentsPanel } from "./ExecutionCommentsPanel";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";

export function RunDetailPage() {
  const { projectId = "", runId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<TestInstanceRow | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [closeRunDialogOpen, setCloseRunDialogOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 15;
  const [addCasesInput, setAddCasesInput] = useState("");
  const [compositionFeedback, setCompositionFeedback] = useState<CompositionFeedback | null>(null);
  const [rerunDialogOpen, setRerunDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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
  const statusQuery = useProjectStatuses(projectId);
  const selectedCaseScenariosQuery = useQuery({
    queryKey: ["case-scenarios", selected?.caseId],
    queryFn: () => fetchCaseScenarios(selected!.caseId),
    enabled: Boolean(selected?.caseId)
  });
  const caseTemplatesQuery = useQuery({
    queryKey: ["case-templates", projectId],
    queryFn: () => fetchCaseTemplates(projectId),
    enabled: Boolean(projectId)
  });
  const isAiEvaluationCase = useMemo(() => {
    const templateId = selectedCaseDetail.data?.caseTemplateId;
    if (templateId == null) return false;
    return (
      caseTemplatesQuery.data?.some(
        (template) => String(template.id) === String(templateId) && template.systemKey === "ai_evaluation"
      ) ?? false
    );
  }, [caseTemplatesQuery.data, selectedCaseDetail.data?.caseTemplateId]);
  const bulkActions = useRunBulkActions({ projectId, runId, pagedInstances });
  const {
    selectedTestIds,
    setSelectedTestIds,
    bulkStatus,
    setBulkStatus,
    bulkComment,
    setBulkComment,
    bulkResultMutation,
    bulkFeedback,
    setBulkFeedback,
    allFilteredSelected,
    canBulkSubmit,
    selectedCount,
    bulkDisableUntested
  } = bulkActions;

  const addResultMutation = useAddRunResultMutation(projectId, runId);
  const closeRunMutation = useCloseRunMutation(projectId, runId);
  const reopenRunMutation = useReopenRunMutation(projectId, runId);
  const addCasesMutation = useAddCasesToRunMutation(projectId, runId);
  const removeTestMutation = useRemoveTestFromRunMutation(projectId, runId);
  const syncCompositionMutation = useSyncRunCompositionMutation(projectId, runId);
  const updateCompositionMutation = useUpdateRunCompositionMutation(projectId, runId);
  const [filterPriority, setFilterPriority] = useState<"" | "low" | "medium" | "high">("");
  const [filterState, setFilterState] = useState<"active" | "archived">("active");
  const assigneeMutation = useUpdateRunAssigneeMutation(projectId, runId);
  const scheduleMutation = useUpdateRunScheduleMutation(projectId, runId);
  const rerunMutation = useRerunMutation(projectId, runId);
  const addAttachmentMutation = useAddResultAttachmentMutation(selectedResultId ?? undefined);
  const openAttachmentDownloadMutation = useOpenAttachmentDownloadMutation();
  const deleteAttachmentMutation = useDeleteAttachmentMutation(selectedResultId ?? undefined);
  const addDefectMutation = useAddResultDefectMutation(selectedResultId ?? undefined);
  const pushDefectMutation = usePushResultDefectMutation(selectedResultId ?? undefined);
  const deleteDefectMutation = useDeleteResultDefectMutation(selectedResultId ?? undefined);
  const subscriptionsQuery = useRunTestSubscriptionsQuery(runId);
  const subscriptionMutation = useTestSubscriptionMutation(runId);
  const subscribedTestIds = useMemo(
    () => new Set(subscriptionsQuery.data ?? []),
    [subscriptionsQuery.data]
  );
  const testNavigation = useRunTestNavigation({
    projectId,
    runId,
    selectedTestId: selected?.id ?? null,
    pagedInstances,
    statusFilter,
    assigneeFilter,
    searchText,
    setStatusFilter,
    setInstancePage,
    onSelectInstance: setSelected
  });
  const runLoaded = Boolean(runDetailQuery.data?.run);
  useRunKeyboardShortcuts({
    enabled: runLoaded && !shortcutsOpen,
    onShowHelp: () => setShortcutsOpen(true),
    onNextTest: testNavigation.goNextTest,
    onPrevTest: testNavigation.goPrevTest,
    onNextFailed: testNavigation.goNextFailed,
    onNextBlocked: testNavigation.goNextBlocked
  });
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
    const filter = runDetailQuery.data?.run.composition?.filterDefinition;
    if (!filter) return;
    setFilterPriority(filter.priority ?? "");
    setFilterState(filter.state ?? "active");
  }, [runDetailQuery.data?.run.composition?.filterDefinition]);

  const rerunStatuses = useMemo(
    () => rerunSelectedStatuses as Array<"passed" | "failed" | "blocked" | "retest" | "untested">,
    [rerunSelectedStatuses]
  );

  if (runDetailQuery.isLoading) return <LoadingState message="Loading run..." />;
  if (runDetailQuery.isError || !runDetailQuery.data || !run) {
    return <ErrorState title="Run not found" onRetry={() => runDetailQuery.refetch()} />;
  }

  const composition = run.composition;
  const compositionSummary = formatCompositionSummary(composition);
  const untestedCount = counts.untested ?? 0;
  const pushedDefectMessage = pushDefectMutation.data
    ? `Pushed ${pushDefectMutation.data.defectKey}${pushDefectMutation.data.url ? ` (${pushDefectMutation.data.url})` : ""}`
    : null;

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
            <p className="text-slate-600">
              Create a new run containing only tests with the selected statuses from this run.
            </p>
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
        confirmLabel={rerunMutation.isPending ? "Creating?" : "Create rerun"}
        confirmDisabled={rerunMutation.isPending || rerunSelectedStatuses.length === 0}
        cancelLabel="Cancel"
        onCancel={() => setRerunDialogOpen(false)}
        onConfirm={async () => {
          await rerunMutation.mutateAsync(rerunStatuses);
          setRerunDialogOpen(false);
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <RunHeader run={run} milestoneName={milestoneQuery.data?.name} counts={counts} />
        </div>
        <PrintLinkButton to={`/projects/${projectId}/runs/${runId}/print`} />
      </div>

      <RunSchedulePanel
        run={run}
        dateWarnings={runDetailQuery.data?.dateWarnings ?? []}
        canEdit={run.status === "open"}
        isSaving={scheduleMutation.isPending}
        onSave={async (patch) => {
          await scheduleMutation.mutateAsync(patch);
        }}
      />

      <CollapsibleSection title="Run discussion" defaultOpen={false}>
        <ExecutionCommentsPanel
          scope="test_run"
          runId={runId}
          canPost={run.status === "open"}
          emptyHint="Discuss this run with your team."
        />
      </CollapsibleSection>

      <RunSummaryBar
        className="lg:hidden"
        counts={counts}
        activeStatus={statusFilter}
        onStatusClick={(status) => testNavigation.jumpToStatus(status)}
      />

      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[minmax(0,1fr)_min(22rem,34vw)]" : ""}`}>
        <div className="flex flex-col gap-3 lg:flex-row">
          <RunDetailSidebar
            projectId={projectId}
            runId={runId}
            counts={counts}
            activeStatus={statusFilter}
            onStatusSelect={(status) => testNavigation.jumpToStatus(status)}
            statusFooter={
              <RunExecutionToolbar
                variant="inline"
                isNavigating={testNavigation.isNavigating}
                onNextFailed={testNavigation.goNextFailed}
                onNextBlocked={testNavigation.goNextBlocked}
                onPrevTest={testNavigation.goPrevTest}
                onNextTest={testNavigation.goNextTest}
                onShowShortcuts={() => setShortcutsOpen(true)}
              />
            }
          />
            <div id="run-tests-section" className="min-w-0 flex-1">
              <RunInstancesSection
          projectId={projectId}
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
          onQuickResultSave={(testId, payload) =>
            void addResultMutation.mutateAsync({
              testId,
              status: payload.status,
              comment: payload.comment,
              elapsed: payload.elapsed,
              version: payload.version,
              defects: payload.defects
            })
          }
          isSavingQuickResult={addResultMutation.isPending}
          page={runInstancesQuery.data?.page ?? instancePage}
          totalPages={runInstancesQuery.data?.totalPages ?? 1}
          total={runInstancesQuery.data?.total ?? 0}
          onPrevPage={() => setInstancePage((p) => Math.max(1, p - 1))}
          onNextPage={() => setInstancePage((p) => Math.min(runInstancesQuery.data?.totalPages ?? 1, p + 1))}
          subscribedTestIds={subscribedTestIds}
          onToggleSubscribe={(testId, subscribed) =>
            void subscriptionMutation.mutateAsync({ testId, subscribed })
          }
                isSubscribePending={subscriptionMutation.isPending}
                hideStatusFilter
              />
            </div>
        </div>

        {selected ? (
          <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {selected.caseCode} · {selected.title}
            </p>
            <div className="mt-2 space-y-3 text-sm text-slate-700">
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
                caseScenarios={selectedCaseScenariosQuery.data ?? []}
                isCaseStepsLoading={selectedCaseDetail.isLoading}
                isSubmitting={addResultMutation.isPending}
                disableUntested={(historyQuery.data?.total ?? 0) > 0 || selected.status !== "untested"}
                hasResultHistory={(historyQuery.data?.total ?? 0) > 0}
                aiEvaluation={
                  isAiEvaluationCase
                    ? { expectedOutput: selectedCaseDetail.data?.aiExpectedOutput || undefined }
                    : undefined
                }
                onSubmit={(payload) => {
                  void addResultMutation.mutateAsync({
                    testId: selected.id,
                    status: payload.status,
                    comment: payload.comment,
                    elapsed: payload.elapsed,
                    version: payload.version,
                    defects: payload.defects,
                    customValues: payload.customValues,
                    stepResults: payload.stepResults,
                    scenarioResults: payload.scenarioResults,
                    aiActualOutput: payload.aiActualOutput,
                    aiQualityRating: payload.aiQualityRating,
                    aiLatencyMs: payload.aiLatencyMs,
                    aiTraces: payload.aiTraces
                  });
                }}
              />
              <CollapsibleSection
                title="Result history"
                badge={historyQuery.data?.total ?? 0}
                defaultOpen={false}
              >
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
                onAddAttachment={(file, onProgress) => void addAttachmentMutation.mutateAsync({ file, onProgress })}
                onOpenAttachmentDownload={(attachmentId) =>
                  void openAttachmentDownloadMutation.mutateAsync(attachmentId)
                }
                onDeleteAttachment={(attachmentId) => void deleteAttachmentMutation.mutateAsync(attachmentId)}
                onAddDefect={(input) => void addDefectMutation.mutateAsync(input)}
                onPushDefect={(input) => void pushDefectMutation.mutateAsync(input)}
                onDeleteDefect={(defectLinkId) => void deleteDefectMutation.mutateAsync(defectLinkId)}
              />
              </CollapsibleSection>
              <CollapsibleSection title="Test discussion" defaultOpen={false}>
                <ExecutionCommentsPanel
                  scope="test_instance"
                  testId={selected.id}
                  canPost={run.status === "open"}
                  emptyHint="Discuss this test without adding a result."
                />
              </CollapsibleSection>
              {run.status === "open" ? (
                <CollapsibleSection title="Composition" defaultOpen={false}>
                <RunCompositionPanel
                  projectId={projectId}
                  compositionMode={composition?.compositionMode ?? "static"}
                  compositionSummary={compositionSummary}
                  filterPriority={filterPriority}
                  filterState={filterState}
                  onFilterPriorityChange={setFilterPriority}
                  onFilterStateChange={setFilterState}
                  isApplyingFilter={updateCompositionMutation.isPending}
                  onApplyFilter={(mode) => {
                    void updateCompositionMutation
                      .mutateAsync({
                        filterDefinition: {
                          ...(filterPriority ? { priority: filterPriority } : {}),
                          state: filterState
                        },
                        filterSelectionMode: mode,
                        sync: true
                      })
                      .then((res) => {
                        if (res.sync && !res.sync.skipped) {
                          setCompositionFeedback({
                            kind: "synced",
                            added: res.sync.added,
                            removed: res.sync.removed
                          });
                          return;
                        }
                        if (res.sync?.skipped && res.sync.reason) {
                          setCompositionFeedback({
                            kind: "error",
                            message: `Sync skipped: ${res.sync.reason}`
                          });
                          return;
                        }
                        setCompositionFeedback({
                          kind: "synced",
                          added: 0,
                          removed: 0
                        });
                      })
                      .catch((err) => {
                        setCompositionFeedback({
                          kind: "error",
                          message: err instanceof Error ? err.message : "Could not apply filter."
                        });
                      });
                  }}
                  isSyncing={syncCompositionMutation.isPending}
                  onSyncComposition={() => {
                    void syncCompositionMutation
                      .mutateAsync()
                      .then((res) => {
                        if (res.skipped) {
                          setCompositionFeedback({
                            kind: "error",
                            message: res.reason ? `Sync skipped: ${res.reason}` : "Sync skipped."
                          });
                          return;
                        }
                        setCompositionFeedback({
                          kind: "synced",
                          added: res.added,
                          removed: res.removed
                        });
                      })
                      .catch((err) => {
                        setCompositionFeedback({
                          kind: "error",
                          message: err instanceof Error ? err.message : "Could not sync composition."
                        });
                      });
                  }}
                  addCasesInput={addCasesInput}
                  onAddCasesInputChange={setAddCasesInput}
                  isAdding={addCasesMutation.isPending}
                  onAddCases={() => {
                    const ids = addCasesInput
                      .split(/[,\s]+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (ids.length === 0) return;
                    void addCasesMutation
                      .mutateAsync(ids)
                      .then((res) => {
                        setAddCasesInput("");
                        const added = res.data.added ?? [];
                        setCompositionFeedback({
                          kind: "added",
                          addedCount: added.length,
                          skipped: res.data.skipped ?? 0,
                          caseIds: added.map((row) => String(row.caseId))
                        });
                      })
                      .catch((err) => {
                        setCompositionFeedback({
                          kind: "error",
                          message: err instanceof Error ? err.message : "Could not add cases."
                        });
                      });
                  }}
                  selectedTestId={selected?.id ?? null}
                  isRemoving={removeTestMutation.isPending}
                  onRemoveWithoutResults={() => {
                    if (!selected) return;
                    void removeTestMutation
                      .mutateAsync({ testId: selected.id })
                      .then((res) => {
                        setCompositionFeedback({
                          kind: "removed",
                          caseId: String(res.data.caseId),
                          title: res.data.titleSnapshot
                        });
                        setSelected(null);
                      })
                      .catch((err) => {
                        setCompositionFeedback({
                          kind: "error",
                          message: err instanceof Error ? err.message : "Could not remove test."
                        });
                      });
                  }}
                  onRemoveWithResults={() => {
                    if (!selected) return;
                    if (!window.confirm("All result history for this test will be deleted. Continue?")) return;
                    void removeTestMutation
                      .mutateAsync({ testId: selected.id, confirmDataLoss: true })
                      .then((res) => {
                        setCompositionFeedback({
                          kind: "removed",
                          caseId: String(res.data.caseId),
                          title: res.data.titleSnapshot
                        });
                        setSelected(null);
                      })
                      .catch((err) => {
                        setCompositionFeedback({
                          kind: "error",
                          message: err instanceof Error ? err.message : "Could not remove test."
                        });
                      });
                  }}
                  feedback={compositionFeedback}
                  onDismissFeedback={() => setCompositionFeedback(null)}
                />
                </CollapsibleSection>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      <CollapsibleSection title="Run actions" defaultOpen={false}>
        <RunActionsPanel
          members={membersQuery.data ?? []}
          statusOptions={statusQuery.data ?? []}
          bulkDisableUntested={bulkDisableUntested}
          bulkStatus={bulkStatus}
          onBulkStatusChange={setBulkStatus}
          bulkComment={bulkComment}
          onBulkCommentChange={setBulkComment}
          canBulkSubmit={canBulkSubmit}
          isBulkPending={bulkResultMutation.isPending}
          selectedCount={selectedCount}
          bulkFeedback={bulkFeedback}
          onDismissBulkFeedback={() => setBulkFeedback(null)}
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
      </CollapsibleSection>
    </div>
  );
}

function formatCompositionSummary(composition: RunCompositionInfo | null | undefined): string | null {
  if (!composition?.lastSyncedAt) return null;
  const parts: string[] = [];
  if (composition.lastSyncAdded != null) parts.push(`+${composition.lastSyncAdded}`);
  if (composition.lastSyncRemoved != null) parts.push(`-${composition.lastSyncRemoved}`);
  const delta = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return `Last sync ${new Date(composition.lastSyncedAt).toLocaleString()}${delta}`;
}
