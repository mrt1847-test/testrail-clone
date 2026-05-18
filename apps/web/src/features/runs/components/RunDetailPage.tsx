import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";
import { fetchCaseScenarios } from "../../cases/api/bddApi";
import { fetchCaseTemplates } from "../../projects/api/settingsApi";
import { fetchPlan } from "../../projects/api/planningApi";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { CollapsibleSection } from "../../../shared/ui/CollapsibleSection";
import { KeyboardShortcutsDialog } from "../../../shared/ui/KeyboardShortcutsDialog";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { fetchAllRunInstances, fetchRuns } from "../api/runApi";
import type { TestInstanceRow } from "../types";
import { useRunBulkActions } from "../hooks/useRunBulkActions";
import { flattenGroupedInstances, mapApiInstancesToRows, mergeInstanceLookup } from "../utils/runInstanceRows";
import {
  readJumpToNextAfterResult,
  readQpaneWidth,
  writeJumpToNextAfterResult,
  writeQpaneWidth
} from "../utils/runExecutionPrefs";
import { useSections } from "../../cases/hooks/useSections";
import { RunSectionTree } from "./RunSectionTree";
import { useCaseExecutionHistoryQuery, useRunInstancesGroupedQuery } from "../hooks/useRunsApi";
import type { TestInstanceTableGroup } from "./TestInstanceTable";
import { extractApiErrorMessage } from "../../cases/caseErrors";
import { useRunDetailQueries } from "../hooks/useRunDetailQueries";
import { useProjectStatuses } from "../hooks/useProjectStatuses";
import { useRunUrlState } from "../hooks/useRunUrlState";
import { useRunColumnPreferences } from "../hooks/useRunColumnPreferences";
import { defaultRunInstanceListFilters } from "../utils/runInstanceListParams";
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
  useSyncResultDefectMutation,
  useDuplicateRunMutation,
  useRerunMutation,
  useUpdateRunAssigneeMutation,
  useUpdateTestAssigneeMutation,
  useUpdateRunScheduleMutation,
  useSyncRunCompositionMutation,
  useUpdateRunCompositionMutation,
  useRunTestSubscriptionsQuery,
  useTestSubscriptionMutation,
} from "../hooks/useRunsApi";
import type { RunCompositionInfo } from "../types";
import { CloseRunDialog } from "./CloseRunDialog";
import { RunActionsPanel } from "./RunActionsPanel";
import { RunDetailHeaderSecondaryActions } from "./RunDetailHeaderActions";
import { RunExecutionStatsBar } from "./RunExecutionStatsBar";
import { RunPlanBreadcrumb } from "./RunPlanBreadcrumb";
import { RunHeader } from "./RunHeader";
import { RunDetailSidebar } from "./RunDetailSidebar";
import { RunExecutionToolbar } from "./RunExecutionToolbar";
import { RunInstancesSection } from "./RunInstancesSection";
import { RUN_DETAIL_SHORTCUTS, useRunKeyboardShortcuts } from "../hooks/useRunKeyboardShortcuts";
import { useRunTestNavigation } from "../hooks/useRunTestNavigation";
import { ResultEntryPanel } from "./ResultEntryPanel";
import { ResultHistoryList } from "./ResultHistoryList";
import { RunQPanePanel } from "./RunQPanePanel";
import { CaseCrossRunHistoryList } from "./CaseCrossRunHistoryList";
import { RunDefectsPanel } from "./RunDefectsPanel";
import { RunCompositionPanel, type CompositionFeedback } from "./RunCompositionPanel";
import { RunSchedulePanel } from "./RunSchedulePanel";
import { ExecutionCommentsPanel } from "./ExecutionCommentsPanel";
import { PushDefectDialog } from "./PushDefectDialog";
import { DuplicateRunDialog } from "./DuplicateRunDialog";
import { RunCompareWithRunDialog } from "./RunCompareWithRunDialog";
import { RunCaseContextPanel } from "./RunCaseContextPanel";
import { TestAssigneeQuickActions } from "./TestAssigneeQuickActions";
import { memberLabelForUserId } from "../utils/assigneeDisplay";
import { ProjectContentHeader } from "../../projects/content-header/ProjectContentHeader";
import { buildRunComparisonPath } from "../utils/runComparisonUrl";

const AT_RISK_STATUSES = new Set(["failed", "blocked", "retest"]);

export function RunDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateCopyAssignee, setDuplicateCopyAssignee] = useState(true);
  const [duplicateCopySchedule, setDuplicateCopySchedule] = useState(false);
  const [duplicateCopyEnvironment, setDuplicateCopyEnvironment] = useState(true);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pushDefectDialogOpen, setPushDefectDialogOpen] = useState(false);
  const [pushDefectResultId, setPushDefectResultId] = useState<string | null>(null);
  const [rerunSelectedStatuses, setRerunSelectedStatuses] = useState<Array<"failed" | "blocked" | "retest">>(["failed"]);
  const instancePageSize = 50;
  const selectedCaseId = selected?.caseId ? Number(selected.caseId) : null;
  const urlState = useRunUrlState({
    searchParams,
    setSearchParams,
    selectedTestId: selected?.id ?? null
  });
  const {
    statusFilter,
    setStatusFilter,
    assigneeFilter,
    setAssigneeFilter,
    searchText,
    setSearchText,
    instancePage,
    setInstancePage,
    sectionId,
    setSectionId,
    groupBy,
    setGroupBy,
    display,
    setDisplay,
    priorityFilter,
    setPriorityFilter,
    caseTypeFilter,
    setCaseTypeFilter,
    caseChangedFilter,
    setCaseChangedFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir
  } = urlState;
  const { effectiveColumns, persistColumns } = useRunColumnPreferences(projectId, runId);
  const [listColumns, setListColumns] = useState(effectiveColumns);
  useEffect(() => {
    setListColumns(effectiveColumns);
  }, [effectiveColumns, runId]);
  const [jumpToNext, setJumpToNext] = useState(readJumpToNextAfterResult);
  const [qpaneWidth, setQpaneWidth] = useState(readQpaneWidth);
  const useGroupedExecution = groupBy !== "none";

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
    searchText,
    priorityFilter,
    caseTypeFilter,
    caseChangedFilter,
    sortBy,
    sortDir
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
  const runPlanId = runDetailQuery.data?.run.planId ?? null;
  const planQuery = useQuery({
    queryKey: ["run-detail-plan", projectId, runPlanId ?? ""],
    queryFn: () => fetchPlan(projectId, runPlanId!),
    enabled: Boolean(projectId && runPlanId)
  });
  const selectedCaseScenariosQuery = useQuery({
    queryKey: ["case-scenarios", selected?.caseId],
    queryFn: () => fetchCaseScenarios(selected!.caseId),
    enabled: Boolean(selected?.caseId)
  });
  const caseExecutionHistoryQuery = useCaseExecutionHistoryQuery(
    projectId,
    selected?.caseId,
    Boolean(selected?.caseId)
  );
  const caseTemplatesQuery = useQuery({
    queryKey: ["case-templates", projectId],
    queryFn: () => fetchCaseTemplates(projectId),
    enabled: Boolean(projectId)
  });
  const runsForCompareQuery = useQuery({
    queryKey: ["runs", projectId, "compare-picker"],
    queryFn: () => fetchRuns(projectId),
    enabled: Boolean(projectId) && compareDialogOpen
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
  const filteredInstanceTotal = runInstancesQuery.data?.total ?? 0;
  const [instanceLookup, setInstanceLookup] = useState<Map<string, TestInstanceRow>>(() => new Map());
  const [selectAllFilteredBusy, setSelectAllFilteredBusy] = useState(false);
  const [assigningTestId, setAssigningTestId] = useState<string | null>(null);

  const bulkActions = useRunBulkActions({
    projectId,
    runId,
    pagedInstances,
    instanceLookup,
    filteredTotal: filteredInstanceTotal
  });
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
    allPageSelected,
    allFilteredSelected,
    canBulkSubmit,
    selectedCount,
    bulkDisableUntested
  } = bulkActions;

  useEffect(() => {
    setInstanceLookup((current) => mergeInstanceLookup(current, pagedInstances));
  }, [pagedInstances]);

  useEffect(() => {
    setSelectedTestIds([]);
    setInstanceLookup(new Map());
  }, [
    runId,
    statusFilter,
    assigneeFilter,
    searchText,
    priorityFilter,
    caseTypeFilter,
    caseChangedFilter,
    sortBy,
    sortDir,
    setSelectedTestIds
  ]);

  const selectAllMatchingFilter = async () => {
    if (filteredInstanceTotal === 0 || selectAllFilteredBusy) return;
    setSelectAllFilteredBusy(true);
    try {
      const instances = await fetchAllRunInstances({
        projectId,
        runId,
        status: statusFilter,
        assignee: assigneeFilter,
        search: searchText,
        priority: priorityFilter || undefined,
        caseType: caseTypeFilter || undefined,
        caseChanged: caseChangedFilter || undefined,
        sortBy,
        sortDir
      });
      const rows = mapApiInstancesToRows(instances);
      setInstanceLookup(mergeInstanceLookup(new Map(), rows));
      setSelectedTestIds(rows.map((row) => row.id));
    } catch (error) {
      setBulkFeedback({
        type: "error",
        message: extractApiErrorMessage(error, "Could not select all matching tests.")
      });
    } finally {
      setSelectAllFilteredBusy(false);
    }
  };

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
  const testAssigneeMutation = useUpdateTestAssigneeMutation(projectId, runId);
  const scheduleMutation = useUpdateRunScheduleMutation(projectId, runId);
  const rerunMutation = useRerunMutation(projectId, runId);
  const duplicateMutation = useDuplicateRunMutation(projectId, runId);
  const addAttachmentMutation = useAddResultAttachmentMutation(selectedResultId ?? undefined);
  const openAttachmentDownloadMutation = useOpenAttachmentDownloadMutation();
  const deleteAttachmentMutation = useDeleteAttachmentMutation(selectedResultId ?? undefined);
  const addDefectMutation = useAddResultDefectMutation(selectedResultId ?? undefined);
  const pushDefectMutation = usePushResultDefectMutation(pushDefectResultId ?? selectedResultId ?? undefined);
  const deleteDefectMutation = useDeleteResultDefectMutation(selectedResultId ?? undefined);
  const syncDefectMutation = useSyncResultDefectMutation(selectedResultId ?? undefined);
  const [syncingDefectLinkId, setSyncingDefectLinkId] = useState<string | null>(null);
  const subscriptionsQuery = useRunTestSubscriptionsQuery(runId);
  const subscriptionMutation = useTestSubscriptionMutation(runId);
  const subscribedTestIds = useMemo(
    () => new Set(subscriptionsQuery.data ?? []),
    [subscriptionsQuery.data]
  );
  const run = runDetailQuery.data?.run;
  const suiteId = run?.suiteId ?? "";
  const sectionsQuery = useSections(projectId, suiteId || undefined);
  const listQueryInput = {
    status: statusFilter,
    assignee: assigneeFilter,
    search: searchText,
    priority: priorityFilter,
    caseType: caseTypeFilter,
    caseChanged: caseChangedFilter,
    sortBy,
    sortDir
  };
  const sectionCountsQuery = useRunInstancesGroupedQuery({
    projectId,
    runId,
    groupBy: "section_id",
    sectionId: null,
    ...listQueryInput,
    enabled: useGroupedExecution && Boolean(suiteId)
  });
  const groupedTableQuery = useRunInstancesGroupedQuery({
    projectId,
    runId,
    groupBy,
    sectionId: sectionId != null ? String(sectionId) : null,
    ...listQueryInput,
    enabled: useGroupedExecution && Boolean(suiteId)
  });
  const resetListPage = () => setInstancePage(1);
  const clearRunListFilters = () => {
    setStatusFilter(defaultRunInstanceListFilters.status);
    setAssigneeFilter(defaultRunInstanceListFilters.assignee);
    setPriorityFilter(defaultRunInstanceListFilters.priority);
    setCaseTypeFilter(defaultRunInstanceListFilters.caseType);
    setCaseChangedFilter(defaultRunInstanceListFilters.caseChanged);
    setSortBy(defaultRunInstanceListFilters.sortBy);
    setSortDir(defaultRunInstanceListFilters.sortDir);
    resetListPage();
  };
  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of sectionCountsQuery.data?.sectionCounts ?? []) {
      map.set(row.sectionId, row.count);
    }
    return map;
  }, [sectionCountsQuery.data?.sectionCounts]);
  const tableGroups: TestInstanceTableGroup[] = useMemo(() => {
    if (!groupedTableQuery.data?.groups) return [];
    return groupedTableQuery.data.groups.map((group) => ({
      groupLabel: group.groupLabel,
      sectionId: group.sectionId,
      instances: mapApiInstancesToRows(group.instances)
    }));
  }, [groupedTableQuery.data?.groups]);
  const executionInstances = useMemo(() => {
    if (useGroupedExecution) return flattenGroupedInstances(groupedTableQuery.data?.groups ?? []);
    return pagedInstances;
  }, [groupedTableQuery.data?.groups, pagedInstances, useGroupedExecution]);
  const groupedTotal = groupedTableQuery.data?.total ?? filteredInstanceTotal;
  const testNavigation = useRunTestNavigation({
    projectId,
    runId,
    selectedTestId: selected?.id ?? null,
    pagedInstances,
    orderedInstances: executionInstances,
    statusFilter,
    assigneeFilter,
    searchText,
    setStatusFilter,
    setInstancePage,
    onSelectInstance: setSelected
  });
  const runLoaded = Boolean(run);
  const runClosed = run?.status === "closed";

  const submitRunResult = async (
    testId: string,
    payload: {
      status: "passed" | "failed" | "blocked" | "retest" | "untested";
      comment?: string;
      elapsed?: string;
      version?: string;
      defects?: string[];
      customValues?: Record<string, string | number | boolean | string[] | null>;
      stepResults?: Array<{
        stepOrder: number;
        status: "passed" | "failed" | "blocked" | "retest" | "untested";
        actualResult?: string;
        comment?: string;
      }>;
      scenarioResults?: Array<{
        caseScenarioId: string;
        status: "passed" | "failed" | "blocked" | "retest" | "untested";
        comment?: string;
      }>;
      aiActualOutput?: string;
      aiQualityRating?: number;
      aiLatencyMs?: number;
      aiTraces?: string;
    },
    options?: { advanceOnPass?: boolean }
  ) => {
    await addResultMutation.mutateAsync({ testId, ...payload });
    if (options?.advanceOnPass && jumpToNext && payload.status === "passed") {
      testNavigation.goNextTest();
    }
  };

  const handlePassAndNext = () => {
    if (!selected || runClosed) return;
    void submitRunResult(selected.id, { status: "passed" }, { advanceOnPass: true });
  };

  useRunKeyboardShortcuts({
    enabled: runLoaded && !shortcutsOpen && !runClosed,
    onShowHelp: () => setShortcutsOpen(true),
    onNextTest: testNavigation.goNextTest,
    onPrevTest: testNavigation.goPrevTest,
    onNextFailed: testNavigation.goNextFailed,
    onNextBlocked: testNavigation.goNextBlocked,
    onNextUntested: testNavigation.goNextUntested,
    onPassAndNext: handlePassAndNext
  });

  const duplicateDefaultName = run ? `${run.name} (copy)` : "";
  const counts = runDetailQuery.data?.counts ?? { passed: 0, failed: 0, blocked: 0, retest: 0, untested: 0 };
  const members = membersQuery.data ?? [];

  const assignTest = async (testId: string, assignedTo: string | null) => {
    if (runClosed) return;
    setAssigningTestId(testId);
    try {
      await testAssigneeMutation.mutateAsync({ testId, assignedTo });
      setSelected((prev) => (prev?.id === testId ? { ...prev, assignedTo } : prev));
    } finally {
      setAssigningTestId(null);
    }
  };

  const assignSelectedTests = async (assignedTo: string | null) => {
    if (runClosed || selectedTestIds.length === 0) return;
    setAssigningTestId("__bulk__");
    try {
      await Promise.all(
        selectedTestIds.map((testId) => testAssigneeMutation.mutateAsync({ testId, assignedTo }))
      );
      setSelected((prev) =>
        prev && selectedTestIds.includes(prev.id) ? { ...prev, assignedTo } : prev
      );
    } finally {
      setAssigningTestId(null);
    }
  };

  useEffect(() => {
    const selectedTestId = searchParams.get("testId");
    if (!selectedTestId) return;
    if (selected?.id === selectedTestId) return;
    const matched = executionInstances.find((row) => row.id === selectedTestId);
    if (matched) setSelected(matched);
  }, [executionInstances, searchParams, selected?.id]);

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

  const pushDefectTargetResult = useMemo(() => {
    if (!selected) return null;
    const items = historyQuery.data?.items ?? [];
    if (selectedResultId) {
      return items.find((row) => row.id === selectedResultId) ?? null;
    }
    return items.find((row) => AT_RISK_STATUSES.has(row.status)) ?? null;
  }, [historyQuery.data?.items, selected, selectedResultId]);

  const pushDefectContext = useMemo(() => {
    const runRow = runDetailQuery.data?.run;
    if (!selected || !runRow || !pushDefectTargetResult) return null;
    return {
      projectId,
      runId,
      runName: runRow.name,
      testId: selected.id,
      testTitle: selected.title,
      resultId: pushDefectTargetResult.id,
      resultStatus: pushDefectTargetResult.status,
      resultComment: pushDefectTargetResult.comment ?? null
    };
  }, [projectId, runId, runDetailQuery.data?.run, selected, pushDefectTargetResult]);

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
  const canPushDefectForSelected = Boolean(selected && AT_RISK_STATUSES.has(selected.status) && pushDefectTargetResult);

  const openPushDefectDialog = () => {
    if (!pushDefectTargetResult) return;
    setPushDefectResultId(pushDefectTargetResult.id);
    setSelectedResultId(pushDefectTargetResult.id);
    setPushDefectDialogOpen(true);
  };

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
      <PushDefectDialog
        open={pushDefectDialogOpen}
        projectId={projectId}
        context={pushDefectContext}
        isSubmitting={pushDefectMutation.isPending}
        errorMessage={pushDefectMutation.isError ? "Could not push defect. Check integration settings." : null}
        onClose={() => {
          setPushDefectDialogOpen(false);
          pushDefectMutation.reset();
        }}
        onSubmit={async (input) => {
          await pushDefectMutation.mutateAsync(input);
          setPushDefectDialogOpen(false);
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
      <RunCompareWithRunDialog
        open={compareDialogOpen}
        projectId={projectId}
        sourceRunId={runId}
        sourceRunName={run.name}
        runs={(runsForCompareQuery.data ?? []).map((row) => ({ id: row.id, name: row.name }))}
        onCancel={() => setCompareDialogOpen(false)}
        onConfirm={(otherRunId) => {
          setCompareDialogOpen(false);
          navigate(buildRunComparisonPath(projectId, { runIdA: runId, runIdB: otherRunId }));
        }}
      />
      <DuplicateRunDialog
        open={duplicateDialogOpen}
        defaultName={duplicateDefaultName}
        name={duplicateName}
        onNameChange={setDuplicateName}
        copyAssignee={duplicateCopyAssignee}
        onCopyAssigneeChange={setDuplicateCopyAssignee}
        copySchedule={duplicateCopySchedule}
        onCopyScheduleChange={setDuplicateCopySchedule}
        copyEnvironment={duplicateCopyEnvironment}
        onCopyEnvironmentChange={setDuplicateCopyEnvironment}
        isPending={duplicateMutation.isPending}
        onCancel={() => setDuplicateDialogOpen(false)}
        onConfirm={async () => {
          const created = await duplicateMutation.mutateAsync({
            name: duplicateName.trim() || undefined,
            copyAssignee: duplicateCopyAssignee,
            copySchedule: duplicateCopySchedule,
            copyEnvironment: duplicateCopyEnvironment
          });
          setDuplicateDialogOpen(false);
          navigate(`/projects/${projectId}/runs/${String(created.run.id)}`);
        }}
      />

      {runPlanId && planQuery.data ? (
        <RunPlanBreadcrumb
          projectId={projectId}
          planId={runPlanId}
          planName={planQuery.data.name}
          runName={run.name}
        />
      ) : null}

      <ProjectContentHeader
        projectId={projectId}
        variant="run-detail"
        title={run.name}
        subtitle={[
          run.environment,
          run.milestoneId ? milestoneQuery.data?.name ?? `Milestone #${run.milestoneId}` : null,
          run.assignedTo?.trim() ? `Assigned: ${run.assignedTo}` : "Unassigned"
        ]
          .filter(Boolean)
          .join(" · ")}
        runId={runId}
        onPushDefect={
          selected
            ? () => {
                setPushDefectResultId(selectedResultId);
                setPushDefectDialogOpen(true);
              }
            : undefined
        }
        secondaryActions={
          <RunDetailHeaderSecondaryActions
            projectId={projectId}
            runId={runId}
            suiteId={suiteId}
            subscribedCount={subscribedTestIds.size}
            totalTests={groupedTotal}
            onScrollToTests={() => testNavigation.scrollToTests()}
          />
        }
      />
      <RunHeader run={run} milestoneName={milestoneQuery.data?.name} showTitle={false} />

      <RunExecutionStatsBar
        className="mt-3 hidden lg:block"
        sticky
        counts={counts}
        activeStatus={statusFilter}
        onStatusClick={(status) => testNavigation.jumpToStatus(status)}
      />

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

      <RunExecutionStatsBar
        className="mt-3 lg:hidden"
        counts={counts}
        activeStatus={statusFilter}
        onStatusClick={(status) => testNavigation.jumpToStatus(status)}
      />

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
            onNextUntested={testNavigation.goNextUntested}
            onPassAndNext={runClosed ? undefined : handlePassAndNext}
            jumpToNext={jumpToNext}
            onJumpToNextChange={(enabled) => {
              setJumpToNext(enabled);
              writeJumpToNextAfterResult(enabled);
            }}
            onPrevTest={testNavigation.goPrevTest}
            onNextTest={testNavigation.goNextTest}
            onShowShortcuts={() => setShortcutsOpen(true)}
          />
        }
      />

      <div
        className={`mt-3 grid gap-3 ${selected ? "lg:grid-cols-[auto_minmax(0,1fr)_var(--run-qpane-width)]" : "lg:grid-cols-[auto_minmax(0,1fr)]"}`}
        style={{ ["--run-qpane-width" as string]: `${qpaneWidth}px` }}
      >
        {useGroupedExecution && suiteId && sectionsQuery.data?.sections ? (
          <RunSectionTree
            sections={sectionsQuery.data.sections}
            sectionCounts={sectionCounts}
            selectedSectionId={sectionId}
            onSelectSection={setSectionId}
            display={display}
            onDisplayChange={setDisplay}
          />
        ) : null}
        <div id="run-tests-section" className="min-w-0">
          {groupedTableQuery.data?.truncated ? (
            <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Showing first 5,000 tests. Narrow filters to see more.
            </p>
          ) : null}
          <RunInstancesSection
          projectId={projectId}
          pagedInstances={useGroupedExecution ? executionInstances : pagedInstances}
          selectedInstanceId={selected?.id ?? null}
          onSelectInstance={setSelected}
          members={members}
          searchText={searchText}
          onSearchTextChange={(value) => {
            setSearchText(value);
            resetListPage();
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            resetListPage();
          }}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={(value) => {
            setAssigneeFilter(value);
            resetListPage();
          }}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={(value) => {
            setPriorityFilter(value);
            resetListPage();
          }}
          caseTypeFilter={caseTypeFilter}
          onCaseTypeFilterChange={(value) => {
            setCaseTypeFilter(value);
            resetListPage();
          }}
          caseChangedFilter={caseChangedFilter}
          onCaseChangedFilterChange={(value) => {
            setCaseChangedFilter(value);
            resetListPage();
          }}
          sortBy={sortBy}
          onSortByChange={(value) => {
            setSortBy(value);
            resetListPage();
          }}
          sortDir={sortDir}
          onSortDirChange={(value) => {
            setSortDir(value);
            resetListPage();
          }}
          groupBy={groupBy}
          onGroupByChange={(value) => {
            setGroupBy(value);
            resetListPage();
          }}
          listColumns={listColumns}
          onListColumnsChange={(columns) => {
            setListColumns(persistColumns(columns));
          }}
          onClearFilters={clearRunListFilters}
          selectedTestIds={selectedTestIds}
          setSelectedTestIds={setSelectedTestIds}
          allPageSelected={allPageSelected}
          allFilteredSelected={allFilteredSelected}
          onSelectAllMatchingFilter={() => void selectAllMatchingFilter()}
          selectAllMatchingBusy={selectAllFilteredBusy}
          onQuickResultSave={(testId, payload) =>
            void submitRunResult(testId, {
              status: payload.status,
              comment: payload.comment,
              elapsed: payload.elapsed,
              version: payload.version,
              defects: payload.defects
            })
          }
          isSavingQuickResult={addResultMutation.isPending}
          groups={useGroupedExecution ? tableGroups : undefined}
          inlineStatusSelect={useGroupedExecution}
          hidePagination={useGroupedExecution}
          groupedTotal={groupedTotal}
          page={runInstancesQuery.data?.page ?? instancePage}
          totalPages={runInstancesQuery.data?.totalPages ?? 1}
          total={useGroupedExecution ? groupedTotal : runInstancesQuery.data?.total ?? 0}
          onPrevPage={() => setInstancePage((p) => Math.max(1, p - 1))}
          onNextPage={() => setInstancePage((p) => Math.min(runInstancesQuery.data?.totalPages ?? 1, p + 1))}
          subscribedTestIds={subscribedTestIds}
          onToggleSubscribe={(testId, subscribed) =>
            void subscriptionMutation.mutateAsync({ testId, subscribed })
          }
                isSubscribePending={subscriptionMutation.isPending}
                hideStatusFilter
                currentUserId={user?.id ?? null}
                onAssignTest={(testId, assignedTo) => void assignTest(testId, assignedTo)}
                assigningTestId={assigningTestId}
                runClosed={runClosed}
              />
        </div>

        {selected ? (
          <aside
            className="relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
            style={{ width: "100%", maxWidth: "100%" }}
          >
            <div
              className="absolute -left-1 top-0 hidden h-full w-1 cursor-col-resize bg-transparent hover:bg-sky-300 lg:block"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize detail panel"
              onMouseDown={(event) => {
                event.preventDefault();
                const startX = event.clientX;
                const startWidth = qpaneWidth;
                const onMove = (moveEvent: MouseEvent) => {
                  const next = Math.min(720, Math.max(280, startWidth - (moveEvent.clientX - startX)));
                  setQpaneWidth(next);
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                  setQpaneWidth((w) => {
                    writeQpaneWidth(w);
                    return w;
                  });
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
            />
            <RunCaseContextPanel
              projectId={projectId}
              caseId={selected.caseId}
              caseCode={selected.caseCode}
              title={selected.title}
              data={selectedCaseDetail.data}
              scenarios={selectedCaseScenariosQuery.data}
              isLoading={selectedCaseDetail.isLoading}
              isError={selectedCaseDetail.isError}
            />
            <div className="mt-2 rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
              <p className="text-[11px] font-medium text-slate-500">Assignee</p>
              <p className="text-sm text-slate-800">{memberLabelForUserId(selected.assignedTo, members)}</p>
              {!runClosed ? (
                <div className="mt-1">
                  <TestAssigneeQuickActions
                    assignedTo={selected.assignedTo}
                    currentUserId={user?.id ?? null}
                    disabled={assigningTestId != null && assigningTestId !== selected.id}
                    pending={assigningTestId === selected.id}
                    onAssignToMe={() => void assignTest(selected.id, user?.id ?? null)}
                    onClearAssignee={() => void assignTest(selected.id, null)}
                  />
                </div>
              ) : null}
            </div>
            {canPushDefectForSelected ? (
              <button
                type="button"
                className="mt-2 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-900 hover:bg-indigo-100"
                onClick={openPushDefectDialog}
              >
                Push defect…
              </button>
            ) : null}
            <RunQPanePanel
              results={
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
                showInstanceHeader={false}
                onSubmit={(payload) => {
                  void submitRunResult(
                    selected.id,
                    {
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
                    },
                    { advanceOnPass: true }
                  );
                }}
              />
              }
              history={
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      This run ({historyQuery.data?.total ?? 0})
                    </p>
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
                isDeletingDefect={deleteDefectMutation.isPending}
                isSyncingDefect={syncDefectMutation.isPending}
                syncingDefectLinkId={syncingDefectLinkId}
                pushedDefectMessage={pushedDefectMessage}
                canPushDefect={canPushDefectForSelected}
                onAddAttachment={(file, onProgress) => void addAttachmentMutation.mutateAsync({ file, onProgress })}
                onOpenAttachmentDownload={(attachmentId) =>
                  void openAttachmentDownloadMutation.mutateAsync(attachmentId)
                }
                onDeleteAttachment={(attachmentId) => void deleteAttachmentMutation.mutateAsync(attachmentId)}
                onAddDefect={(input) => void addDefectMutation.mutateAsync(input)}
                onOpenPushDefect={openPushDefectDialog}
                onDeleteDefect={(defectLinkId) => void deleteDefectMutation.mutateAsync(defectLinkId)}
                onSyncDefect={(defectLinkId) => {
                  setSyncingDefectLinkId(defectLinkId);
                  void syncDefectMutation.mutateAsync(defectLinkId).finally(() => setSyncingDefectLinkId(null));
                }}
              />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      All runs (case {selected.caseCode})
                    </p>
                    <CaseCrossRunHistoryList
                      projectId={projectId}
                      currentRunId={runId}
                      items={caseExecutionHistoryQuery.data?.items ?? []}
                      isLoading={caseExecutionHistoryQuery.isLoading}
                    />
                  </div>
                </div>
              }
              defects={
                <RunDefectsPanel
                  projectId={projectId}
                  runId={runId}
                  history={historyQuery.data?.items ?? []}
                  linkedDefects={defectsQuery.data ?? []}
                  isLoading={defectsQuery.isLoading}
                  canPushDefect={canPushDefectForSelected}
                  onOpenPushDefect={openPushDefectDialog}
                />
              }
            />
            <div className="mt-3 space-y-3 text-sm text-slate-700">
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
          members={members}
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
          currentUserId={user?.id ?? null}
          onAssignRunToMe={
            user?.id && !runClosed ? () => void assigneeMutation.mutateAsync(user.id) : undefined
          }
          onClearRunAssignee={!runClosed ? () => void assigneeMutation.mutateAsync(null) : undefined}
          onAssignSelectedToMe={
            user?.id && !runClosed ? () => void assignSelectedTests(user.id) : undefined
          }
          onClearSelectedAssignees={!runClosed ? () => void assignSelectedTests(null) : undefined}
          isTestAssignPending={testAssigneeMutation.isPending}
          isRerunPending={rerunMutation.isPending}
          onOpenRerunDialog={() => setRerunDialogOpen(true)}
          isDuplicatePending={duplicateMutation.isPending}
          onOpenDuplicateDialog={() => {
            setDuplicateName("");
            setDuplicateCopyAssignee(true);
            setDuplicateCopySchedule(false);
            setDuplicateCopyEnvironment(true);
            setDuplicateDialogOpen(true);
          }}
          onOpenCompareDialog={() => setCompareDialogOpen(true)}
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
