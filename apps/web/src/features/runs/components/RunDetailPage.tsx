import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";
import { useUiDensity } from "../../../shared/hooks/useUiDensity";
import { fetchCaseScenarios } from "../../cases/api/bddApi";
import { fetchCaseTemplates } from "../../projects/api/settingsApi";
import { fetchPlan } from "../../projects/api/planningApi";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { CollapsibleSection } from "../../../shared/ui/CollapsibleSection";
import { KeyboardShortcutsDialog } from "../../../shared/ui/KeyboardShortcutsDialog";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { fetchAllRunInstances, fetchRuns, associateResultAttachment } from "../api/runApi";
import type { TestInstanceRow } from "../types";
import { useRunBulkActions } from "../hooks/useRunBulkActions";
import { flattenGroupedInstances, mapApiInstancesToRows, mergeInstanceLookup } from "../utils/runInstanceRows";
import { shouldExpandRunSchedulePanel } from "../utils/runExecutionDensity";
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
import { nextVisibleTestId, resolveVisibleSelectedRunTest } from "../utils/runSelectedTestState";
import { createdResultId, stagedAttachmentsFromPayload, type StagedComposerUploadPatch } from "../utils/resultComposerModel";
import type { ResultStatus } from "./resultEntryTypes";
import {
  RESULT_SAVE_CLEARED_MS,
  RESULT_SAVE_UNDO_MS,
  canUndoResultSave,
  overlayInstanceStatus,
  pruneMatchedStatusOverrides,
  resultSaveErrorMessage,
  type ResultSaveAdvanceOptions,
  type ResultSaveFeedback,
  type ResultSaveRetryPayload
} from "../utils/resultSaveFeedback";
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
  runKeys
} from "../hooks/useRunsApi";
import type { RunCompositionInfo } from "../types";
import { CloseRunDialog } from "./CloseRunDialog";
import { RunPlanBreadcrumb } from "./RunPlanBreadcrumb";
import { RunDetailSidebar } from "./RunDetailSidebar";
import { RunExecutionToolbar } from "./RunExecutionToolbar";
import { RunExecutionHeader } from "./RunExecutionHeader";
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
import { useEntityContextMenu } from "../../../shared/ui/EntityContextMenu";
import { useRecordRecentlyViewed } from "../../projects/hooks/useRecordRecentlyViewed";
import { buildRunComparisonPath } from "../utils/runComparisonUrl";

const AT_RISK_STATUSES = new Set(["failed", "blocked", "retest"]);

export function RunDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { projectId = "", runId = "" } = useParams();
  const [runUiDensity, setRunUiDensity] = useUiDensity(projectId, "run-execution", user?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<TestInstanceRow | null>(null);
  const [composerStatus, setComposerStatus] = useState<ResultStatus | null>(null);
  const [isAssociatingAttachments, setIsAssociatingAttachments] = useState(false);
  const pendingSelectedTestIdRef = useRef<string | null>(null);
  const selectedRef = useRef<TestInstanceRow | null>(null);
  selectedRef.current = selected;
  const writeSelectedTestId = useCallback(
    (testId: string | null) => {
      pendingSelectedTestIdRef.current = testId;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (testId) next.set("testId", testId);
          else next.delete("testId");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const selectInstance = useCallback(
    (instance: TestInstanceRow, options?: { composerStatus?: ResultStatus | null }) => {
      setComposerStatus(options?.composerStatus ?? null);
      setSelected(instance);
      writeSelectedTestId(instance.id);
    },
    [writeSelectedTestId]
  );
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<ResultSaveFeedback | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [stagedUploadById, setStagedUploadById] = useState<Record<string, StagedComposerUploadPatch>>({});
  const saveTimersRef = useRef<{ undo: number | null; clear: number | null }>({ undo: null, clear: null });
  const lastCommittedStatusRef = useRef<Record<string, ResultStatus>>({});
  const saveFeedbackRef = useRef<ResultSaveFeedback | null>(null);
  saveFeedbackRef.current = saveFeedback;
  const stagedUploadByIdRef = useRef(stagedUploadById);
  stagedUploadByIdRef.current = stagedUploadById;
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
    setSearchParams
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
  useRecordRecentlyViewed(
    projectId,
    run ? { kind: "run", id: runId, title: run.name, subtitle: `Status: ${run.status}` } : null
  );
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
  const displayedExecutionInstances = useMemo(
    () => overlayInstanceStatus(executionInstances, statusOverrides),
    [executionInstances, statusOverrides]
  );
  const displayedTableGroups = useMemo(
    () =>
      tableGroups.map((group) => ({
        ...group,
        instances: overlayInstanceStatus(group.instances, statusOverrides)
      })),
    [tableGroups, statusOverrides]
  );
  const groupedTotal = groupedTableQuery.data?.total ?? filteredInstanceTotal;
  const hasSectionTree = useGroupedExecution && Boolean(suiteId && sectionsQuery.data?.sections);
  const workbenchGridClass = selected
    ? hasSectionTree
      ? "lg:grid-cols-[auto_auto_minmax(0,1fr)_var(--run-qpane-width)]"
      : "lg:grid-cols-[auto_minmax(0,1fr)_var(--run-qpane-width)]"
    : hasSectionTree
      ? "lg:grid-cols-[auto_auto_minmax(0,1fr)]"
      : "lg:grid-cols-[auto_minmax(0,1fr)]";
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
    onSelectInstance: selectInstance
  });
  const runLoaded = Boolean(run);
  const runClosed = run?.status === "closed";

  const clearSaveTimers = useCallback(() => {
    if (saveTimersRef.current.undo != null) window.clearTimeout(saveTimersRef.current.undo);
    if (saveTimersRef.current.clear != null) window.clearTimeout(saveTimersRef.current.clear);
    saveTimersRef.current = { undo: null, clear: null };
  }, []);

  useEffect(() => () => clearSaveTimers(), [clearSaveTimers]);

  useEffect(() => {
    setStatusOverrides((current) => pruneMatchedStatusOverrides(current, executionInstances));
  }, [executionInstances]);

  const resolvePreviousStatus = useCallback((testId: string): ResultStatus => {
    const committed = lastCommittedStatusRef.current[testId];
    if (committed) return committed;
    const row = executionInstances.find((item) => item.id === testId);
    if (row?.status) return row.status as ResultStatus;
    if (selectedRef.current?.id === testId) return selectedRef.current.status as ResultStatus;
    return "untested";
  }, [executionInstances]);

  const scheduleSavedClear = useCallback(
    (testId: string, canUndo: boolean) => {
      clearSaveTimers();
      if (canUndo) {
        saveTimersRef.current.undo = window.setTimeout(() => {
          setSaveFeedback((current) =>
            current?.testId === testId && current.status === "saved" ? { ...current, canUndo: false } : current
          );
        }, RESULT_SAVE_UNDO_MS);
        saveTimersRef.current.clear = window.setTimeout(() => {
          setSaveFeedback((current) => (current?.testId === testId && current.status === "saved" ? null : current));
        }, RESULT_SAVE_UNDO_MS);
      } else {
        saveTimersRef.current.clear = window.setTimeout(() => {
          setSaveFeedback((current) => (current?.testId === testId && current.status === "saved" ? null : current));
        }, RESULT_SAVE_CLEARED_MS);
      }
    },
    [clearSaveTimers]
  );

  const patchStagedUpload = useCallback((id: string, patch: StagedComposerUploadPatch) => {
    setStagedUploadById((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }, []);

  const associateStagedAttachments = useCallback(
    async (resultId: string, items: Array<{ id: string; file: File }>) => {
      if (items.length === 0) return;
      setIsAssociatingAttachments(true);
      const failures: string[] = [];
      try {
        for (const item of items) {
          if (stagedUploadByIdRef.current[item.id]?.status === "uploaded") continue;
          patchStagedUpload(item.id, { status: "uploading", progress: 0 });
          try {
            await associateResultAttachment(resultId, item.file, (progress) => {
              patchStagedUpload(item.id, { status: "uploading", progress });
            });
            patchStagedUpload(item.id, { status: "uploaded", progress: 100 });
          } catch (error) {
            patchStagedUpload(item.id, { status: "failed", message: resultSaveErrorMessage(error) });
            failures.push(item.file.name);
          }
        }
        await queryClient.invalidateQueries({ queryKey: runKeys.resultAttachments(resultId) });
        if (failures.length === 1) throw new Error(`Couldn't attach ${failures[0]}`);
        if (failures.length > 1) throw new Error(`Couldn't attach ${failures.length} files`);
      } finally {
        setIsAssociatingAttachments(false);
      }
    },
    [patchStagedUpload, queryClient]
  );

  const submitRunResult = async (
    testId: string,
    payload: ResultSaveRetryPayload,
    options?: ResultSaveAdvanceOptions
  ) => {
    if (runClosed) return;
    if (saveFeedbackRef.current?.status === "saving") return;
    const stagedItems = stagedAttachmentsFromPayload(payload);
    if (saveFeedbackRef.current?.status === "failed" && saveFeedbackRef.current.createdResultId && stagedItems.length > 0) {
      const existingId = saveFeedbackRef.current.createdResultId;
      clearSaveTimers();
      setSaveFeedback({
        ...saveFeedbackRef.current,
        status: "saving",
        message: "Saving…",
        canUndo: false,
        retryPayload: payload,
        retryAdvance: options
      });
      try {
        await associateStagedAttachments(existingId, stagedItems);
        const canUndo = canUndoResultSave(saveFeedbackRef.current.previousStatus);
        setSaveFeedback({
          testId,
          status: "saved",
          message: "Saved",
          previousStatus: saveFeedbackRef.current.previousStatus,
          canUndo,
          retryPayload: payload,
          retryAdvance: options,
          createdResultId: existingId
        });
        scheduleSavedClear(testId, canUndo);
        return;
      } catch (error) {
        setSaveFeedback({
          testId,
          status: "failed",
          message: resultSaveErrorMessage(error),
          previousStatus: saveFeedbackRef.current.previousStatus,
          canUndo: false,
          retryPayload: payload,
          retryAdvance: options,
          createdResultId: existingId
        });
        throw error;
      }
    }

    const previousStatus = resolvePreviousStatus(testId);
    const { attachments: _attachments, stagedAttachments: _stagedAttachments, ...resultPayload } = payload;
    clearSaveTimers();
    setStatusOverrides((current) => ({ ...current, [testId]: payload.status }));
    setSaveFeedback({
      testId,
      status: "saving",
      message: "Saving…",
      previousStatus,
      canUndo: false,
      retryPayload: payload,
      retryAdvance: options
    });

    let createdId: string | null = null;
    try {
      const created = await addResultMutation.mutateAsync({ testId, ...resultPayload });
      createdId = createdResultId(created);
      if (createdId) setSelectedResultId(createdId);
      lastCommittedStatusRef.current[testId] = payload.status;
      if (createdId) {
        await associateStagedAttachments(createdId, stagedAttachmentsFromPayload(payload));
      }
      const canUndo = canUndoResultSave(previousStatus);
      setSaveFeedback({
        testId,
        status: "saved",
        message: "Saved",
        previousStatus,
        canUndo,
        retryPayload: payload,
        retryAdvance: options,
        createdResultId: createdId
      });
      scheduleSavedClear(testId, canUndo);
      const nextId =
        options?.advanceToTestId ??
        (options?.advanceOnPass && payload.status === "passed" && jumpToNext
          ? nextVisibleTestId(testId, executionInstances)
          : null);
      if (nextId && nextId !== testId) {
        const nextRow = displayedExecutionInstances.find((row) => row.id === nextId);
        if (nextRow) selectInstance(nextRow);
        else writeSelectedTestId(nextId);
      }
    } catch (error) {
      if (!createdId) {
        setStatusOverrides((current) => {
          const next = { ...current };
          delete next[testId];
          return next;
        });
      }
      setSaveFeedback({
        testId,
        status: "failed",
        message: resultSaveErrorMessage(error),
        previousStatus,
        canUndo: false,
        retryPayload: payload,
        retryAdvance: options,
        createdResultId: createdId
      });
      throw error;
    }
  };

  const retryResultSave = () => {
    const current = saveFeedbackRef.current;
    if (!current || current.status !== "failed") return;
    void submitRunResult(current.testId, current.retryPayload, current.retryAdvance);
  };

  const retryStagedAttachment = (id: string) => {
    const current = saveFeedbackRef.current;
    const resultId = current?.createdResultId;
    if (!current || !resultId) return;
    const item = stagedAttachmentsFromPayload(current.retryPayload).find((row) => row.id === id);
    if (!item) return;
    void (async () => {
      try {
        setSaveFeedback({ ...current, status: "saving", message: "Saving…", canUndo: false });
        await associateStagedAttachments(resultId, [item]);
        const unfinished = stagedAttachmentsFromPayload(current.retryPayload).some(
          (row) => stagedUploadByIdRef.current[row.id]?.status !== "uploaded"
        );
        if (unfinished) {
          setSaveFeedback({
            ...current,
            status: "failed",
            message: "Couldn't attach one or more files",
            canUndo: false
          });
          return;
        }
        const canUndo = canUndoResultSave(current.previousStatus);
        setSaveFeedback({
          ...current,
          status: "saved",
          message: "Saved",
          canUndo
        });
        scheduleSavedClear(current.testId, canUndo);
      } catch (error) {
        setSaveFeedback({
          ...current,
          status: "failed",
          message: resultSaveErrorMessage(error),
          canUndo: false
        });
      }
    })();
  };

  const undoResultSave = () => {
    const current = saveFeedbackRef.current;
    if (!current || current.status !== "saved" || !current.canUndo) return;
    void submitRunResult(current.testId, { status: current.previousStatus });
  };

  const handlePassAndNext = () => {
    if (!selected || runClosed || addResultMutation.isPending) return;
    const nextId = nextVisibleTestId(selected.id, executionInstances);
    void submitRunResult(selected.id, { status: "passed" }, { advanceToTestId: nextId });
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
    const dataReady = useGroupedExecution ? !groupedTableQuery.isLoading : !runInstancesQuery.isLoading;
    if (!dataReady) return;
    const urlTestId = searchParams.get("testId");
    if (urlTestId === pendingSelectedTestIdRef.current) {
      pendingSelectedTestIdRef.current = null;
    }
    const resolved = resolveVisibleSelectedRunTest({
      urlTestId,
      instances: displayedExecutionInstances,
      pendingTestId: pendingSelectedTestIdRef.current,
      current: selectedRef.current
    });
    setSelected(resolved.selected);
    if (resolved.seedUrlTestId) writeSelectedTestId(resolved.seedUrlTestId);
  }, [
    displayedExecutionInstances,
    groupedTableQuery.isLoading,
    runInstancesQuery.isLoading,
    searchParams,
    useGroupedExecution,
    writeSelectedTestId
  ]);

  useEffect(() => {
    setSelectedResultId(null);
    setHistoryPage(1);
    setStagedUploadById({});
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
    const caseDetail = selectedCaseDetail.data;
    return {
      projectId,
      runId,
      runName: runRow.name,
      testId: selected.id,
      testTitle: selected.title,
      resultId: pushDefectTargetResult.id,
      resultStatus: pushDefectTargetResult.status,
      resultComment: pushDefectTargetResult.comment ?? null,
      caseCode: selected.caseCode,
      caseTitle: caseDetail?.title ?? selected.title,
      casePreconditions: caseDetail?.preconditions ?? null,
      caseExpected: caseDetail?.expectedResult ?? null,
      caseRefs: caseDetail?.references ?? null
    };
  }, [
    projectId,
    runId,
    runDetailQuery.data?.run,
    selected,
    pushDefectTargetResult,
    selectedCaseDetail.data
  ]);

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

  const { openEntityContextMenu } = useEntityContextMenu();

  return (
    <div
      className="space-y-3"
      onContextMenu={(event) =>
        openEntityContextMenu(event, { projectId, kind: "run", entityId: runId })
      }
    >
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

      <RunExecutionHeader
        projectId={projectId}
        runId={runId}
        suiteId={suiteId}
        run={run}
        milestoneName={milestoneQuery.data?.name}
        members={members}
        assigneeInput={assigneeInput}
        onAssigneeInputChange={setAssigneeInput}
        onAssignRun={() => void assigneeMutation.mutateAsync(assigneeInput.trim() || null)}
        isAssignPending={assigneeMutation.isPending}
        onOpenDuplicate={() => {
          setDuplicateName("");
          setDuplicateCopyAssignee(true);
          setDuplicateCopySchedule(false);
          setDuplicateCopyEnvironment(true);
          setDuplicateDialogOpen(true);
        }}
        isDuplicatePending={duplicateMutation.isPending}
        onOpenCompare={() => setCompareDialogOpen(true)}
        onOpenRerun={() => setRerunDialogOpen(true)}
        isRerunPending={rerunMutation.isPending}
        onOpenCloseRun={() => setCloseRunDialogOpen(true)}
        isCloseRunPending={closeRunMutation.isPending}
        onReopenRun={() => void reopenRunMutation.mutateAsync()}
        isReopenRunPending={reopenRunMutation.isPending}
        onPushDefect={canPushDefectForSelected ? openPushDefectDialog : undefined}
      />

      <div
        data-run-workbench=""
        className={`mt-2 grid min-h-0 grid-cols-1 gap-3 lg:max-h-[calc(100dvh-17.5rem)] ${workbenchGridClass}`}
        style={{ ["--run-qpane-width" as string]: `${qpaneWidth}px` }}
      >
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
              isSavingResult={addResultMutation.isPending}
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
        {hasSectionTree && sectionsQuery.data?.sections ? (
          <RunSectionTree
            sections={sectionsQuery.data.sections}
            sectionCounts={sectionCounts}
            selectedSectionId={sectionId}
            onSelectSection={(value) => {
              setSectionId(value);
              resetListPage();
            }}
            display={display}
            onDisplayChange={setDisplay}
          />
        ) : null}
        <div id="run-tests-section" className="flex min-h-0 min-w-0 flex-col lg:h-full lg:overflow-hidden">
          {groupedTableQuery.data?.truncated ? (
            <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Showing first 5,000 tests. Narrow filters to see more.
            </p>
          ) : null}
          <RunInstancesSection
          projectId={projectId}
          pagedInstances={displayedExecutionInstances}
          selectedInstanceId={selected?.id ?? null}
          onSelectInstance={selectInstance}
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
            if (value === "none") setSectionId(null);
            resetListPage();
          }}
          listColumns={listColumns}
          onListColumnsChange={(columns) => {
            setListColumns(persistColumns(columns));
          }}
          onClearFilters={clearRunListFilters}
          selectedTestIds={selectedTestIds}
          setSelectedTestIds={setSelectedTestIds}
          statusOptions={statusQuery.data ?? []}
          bulkStatus={bulkStatus}
          onBulkStatusChange={setBulkStatus}
          bulkDisableUntested={bulkDisableUntested}
          bulkComment={bulkComment}
          onBulkCommentChange={setBulkComment}
          canBulkSubmit={!runClosed && canBulkSubmit}
          isBulkPending={bulkResultMutation.isPending}
          bulkFeedback={bulkFeedback}
          onDismissBulkFeedback={() => setBulkFeedback(null)}
          onBulkSubmit={() => {
            if (!runClosed) void bulkResultMutation.mutateAsync();
          }}
          onAssignSelected={(assignedTo) => void assignSelectedTests(assignedTo)}
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
          onComposeResult={(instance, status) => {
            selectInstance(instance, { composerStatus: status });
            window.requestAnimationFrame(() => {
              document.getElementById("run-result-composer")?.scrollIntoView({ block: "nearest" });
            });
          }}
          isSavingQuickResult={addResultMutation.isPending || isAssociatingAttachments}
          saveFeedback={saveFeedback}
          onRetrySave={retryResultSave}
          onUndoSave={undoResultSave}
          groups={useGroupedExecution ? displayedTableGroups : undefined}
          inlineStatusSelect
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
                density={runUiDensity}
                onDensityChange={setRunUiDensity}
              />
        </div>

        {selected ? (
          <aside
            id="run-result-composer"
            aria-live="polite"
            className="relative min-h-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:h-full lg:overflow-y-auto"
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
              key={selected.id}
              results={
                runClosed ? (
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    This run is closed. Result entry is read-only; reopen the run to add results.
                  </div>
                ) : (
                  <ResultEntryPanel
                    key={`${selected.id}:${composerStatus ?? "default"}`}
                    projectId={projectId}
                    instance={{
                      id: selected.id,
                      caseId: selected.caseId,
                      caseCode: selected.caseCode,
                      title: selected.title
                    }}
                    initialStatus={composerStatus}
                    caseSteps={selectedCaseDetail.data?.steps ?? []}
                    caseScenarios={selectedCaseScenariosQuery.data ?? []}
                    isCaseStepsLoading={selectedCaseDetail.isLoading}
                    isSubmitting={addResultMutation.isPending || isAssociatingAttachments}
                    disableUntested={(historyQuery.data?.total ?? 0) > 0 || selected.status !== "untested"}
                    hasResultHistory={(historyQuery.data?.total ?? 0) > 0}
                    aiEvaluation={
                      isAiEvaluationCase
                        ? { expectedOutput: selectedCaseDetail.data?.aiExpectedOutput || undefined }
                        : undefined
                    }
                    showInstanceHeader={false}
                    saveFeedback={
                      saveFeedback?.testId === selected.id
                        ? {
                            status: saveFeedback.status,
                            message: saveFeedback.message,
                            canUndo: saveFeedback.canUndo
                          }
                        : null
                    }
                    onRetrySave={retryResultSave}
                    onUndoSave={undoResultSave}
                    attachmentUploadById={stagedUploadById}
                    onRetryStagedAttachment={retryStagedAttachment}
                    onCancel={() => {
                      setComposerStatus(null);
                      setStagedUploadById({});
                    }}
                    onSubmit={(payload) =>
                      submitRunResult(
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
                          aiTraces: payload.aiTraces,
                          attachments: payload.attachments,
                          stagedAttachments: payload.stagedAttachments
                        },
                        { advanceOnPass: true }
                      )
                    }
                  />
                )
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
          </aside>
        ) : null}
      </div>

      <div className="space-y-2">
        <CollapsibleSection
          title="Schedule"
          defaultOpen={shouldExpandRunSchedulePanel({
            startedAt: run.startedAt,
            dueOn: run.dueOn,
            closedAt: run.closedAt,
            warningCount: runDetailQuery.data?.dateWarnings?.length ?? 0
          })}
        >
          <RunSchedulePanel
            run={run}
            dateWarnings={runDetailQuery.data?.dateWarnings ?? []}
            canEdit={run.status === "open"}
            isSaving={scheduleMutation.isPending}
            embedded
            onSave={async (patch) => {
              await scheduleMutation.mutateAsync(patch);
            }}
          />
        </CollapsibleSection>
        {selected ? (
          <CollapsibleSection title="Test discussion" defaultOpen={false}>
            <ExecutionCommentsPanel
              projectId={projectId}
              scope="test_instance"
              testId={selected.id}
              canPost={run.status === "open"}
              emptyHint="Discuss this test without adding a result."
            />
          </CollapsibleSection>
        ) : null}
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
                      caseIds: added.map((row: { caseId: string | number }) => String(row.caseId))
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
                    writeSelectedTestId(null);
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
                    writeSelectedTestId(null);
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
        <CollapsibleSection title="Run discussion" defaultOpen={false}>
          <ExecutionCommentsPanel
            projectId={projectId}
            scope="test_run"
            runId={runId}
            canPost={run.status === "open"}
            emptyHint="Discuss this run with your team."
          />
        </CollapsibleSection>
      </div>

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
