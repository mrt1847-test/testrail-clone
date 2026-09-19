import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps
} from "react";
import { buildCasesPrintPath } from "../../print/api/printApi";

import {
  hasRangeMultiSelectModifier,
  resolveRangeMultiSelectClick
} from "../../../shared/selection/rangeMultiSelect";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useAuth } from "../../auth/context/AuthContext";
import { useProjectArchived } from "../../projects/context/ProjectArchiveContext";
import { useUiDensity } from "../../../shared/hooks/useUiDensity";
import { fetchCaseTemplates, fetchCustomFieldsForUse } from "../../projects/api/settingsApi";
import { fetchSuites } from "../../projects/api/suitesApi";
import { projectKeys, useProjectsQuery } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import {
  apiCasePriorityValue,
  apiCaseTypeValue,
  draftStepsForTextPersist
} from "../utils/caseAuthoringInstructions";
import {
  bulkArchiveCases,
  bulkCopyCases,
  bulkDeleteCases,
  bulkMoveCases,
  bulkUpdateCases,
  updateCase,
  createCase,
  createCaseStep,
  fetchSectionsForProject,
  positionCases
} from "../api/catalogApi";
import {
  caseQueryScopeEmptyTitle,
  fetchSectionIdForQuery,
  sectionScopeForQuery
} from "../caseRepositoryView";
import { extractApiErrorMessage } from "../caseErrors";
import type { BulkCaseFeedback } from "../utils/bulkCaseFeedback";
import { buildBulkCaseFeedback } from "../utils/bulkCaseFeedback";
import type { CaseListDnD, PendingMoveCopy } from "../hooks/useCaseListDnD";
import { useCaseListKeyboardNav } from "../hooks/useCaseListKeyboardNav";
import { useCaseColumnPreferences } from "../hooks/useCaseColumnPreferences";
import { useCaseLastViewState } from "../hooks/useCaseLastViewState";
import { useCaseSavedViews } from "../hooks/useCaseSavedViews";
import { useWorkspacePreferences } from "../../projects/hooks/useWorkspacePreferences";
import { caseKeys } from "../hooks/useCases";
import { useSuiteCases } from "../hooks/useSuiteCases";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { sectionKeys } from "../hooks/useSections";
import type { SectionNode, TestCase } from "../types";
import { CaseAuthoringForm } from "./CaseAuthoringForm";
import { CaseBulkRelocationDialog } from "./CaseBulkRelocationDialog";
import { CaseRepositoryToolbar } from "./CaseRepositoryToolbar";
import { CaseQueryScopeControl } from "./CaseQueryScopeControl";
import { CaseRow } from "./CaseRow";
import { CaseSelectionActionBar } from "./CaseSelectionActionBar";
import { MoveCopyChooserDialog } from "./MoveCopyChooserDialog";
import { caseDeleteCopy } from "../caseDeleteCopy";
import { mapFetchedSuiteGroups, regroupRepositoryCases } from "../utils/caseRepositoryGrouping";
import {
  applySectionPathLabels,
  collapsedHiddenSelectedCount,
  collapseAllGroupKeys,
  expandAllGroupKeys,
  sectionBlockToggleLabel,
  shouldShowCaseGroupHeaders,
  toggleCollapsedGroupKey
} from "../utils/caseListSectionBlocks";
import { sortSectionIdsDepthFirst } from "../utils/sectionTreeOrder";
import { sectionPathLabel } from "../utils/sectionTreeModel";
import { sectionBlockAddCaseLabel } from "../utils/caseListRowPresentation";

type CaseListPaneProps = {
  projectId: string;
  suiteId: string;
  addCaseRequest?: number;
  copyMoveRequest?: number;
  sections: SectionNode[];
  dnd?: CaseListDnD;
  pendingMoveCopy?: PendingMoveCopy | null;
  onPendingMoveCopyChange?: (pending: PendingMoveCopy | null) => void;
};

async function persistCreateDraftSteps(
  caseId: number,
  drafts: Array<{ description: string; expected: string }>
): Promise<void> {
  for (const row of drafts) {
    const content = row.description.trim();
    const expected = row.expected.trim();
    if (content.length > 0) {
      await createCaseStep(caseId, {
        content,
        expectedResult: expected.length > 0 ? expected : null
      });
    } else if (expected.length > 0) {
      await createCaseStep(caseId, { content: "-", expectedResult: expected });
    }
  }
}

export function CaseListPane({
  projectId,
  suiteId,
  addCaseRequest = 0,
  copyMoveRequest = 0,
  sections,
  dnd,
  pendingMoveCopy = null,
  onPendingMoveCopyChange
}: CaseListPaneProps) {
  type BulkPriorityValue = "" | "low" | "medium" | "high";
  type BulkCaseTypeValue = "" | "functional" | "integration" | "regression";

  const qc = useQueryClient();
  const { user } = useAuth();
  const isProjectArchived = useProjectArchived();
  const [uiDensity, setUiDensity] = useUiDensity(projectId, "case-repository", user?.id);
  const {
    selectedSectionId,
    panelCaseId,
    panelMode,
    focusCaseId,
    setFocusCaseId,
    caseDisplay,
    caseQueryScope,
    caseGroupBy,
    caseFilters,
    caseColumns,
    hasCaseColumnsParam,
    hasRepositoryViewParams,
    setCaseFilters,
    setCaseColumns,
    setCaseGroupBy,
    setCaseQueryScope,
    clearCaseFilters,
    applySavedView,
    applyRepositoryView,
    togglePanelCase,
    setPanelCase,
    setSelectedSection,
    setTreeFocusSection
  } = useExpandedCase();

  const repositoryCaseFilters = useMemo(
    () => ({ ...caseFilters, sectionScope: sectionScopeForQuery(caseQueryScope) }),
    [caseFilters, caseQueryScope]
  );
  const suiteFetchSectionId = fetchSectionIdForQuery(caseQueryScope, selectedSectionId);
  const { effectiveColumns, columnWidths, persistColumns, persistColumnWidths } = useCaseColumnPreferences(
    projectId,
    suiteId,
    user?.id,
    caseColumns,
    hasCaseColumnsParam
  );
  const { data: suiteCaseData, isLoading, isError, refetch } = useSuiteCases(
    projectId,
    suiteId,
    suiteFetchSectionId,
    repositoryCaseFilters,
    caseDisplay,
    caseGroupBy,
    caseQueryScope
  );
  const createTargetSectionId = selectedSectionId ?? sections[0]?.id ?? null;
  const cases = suiteCaseData?.cases ?? [];
  const { data: customFields = [] } = useQuery({
    queryKey: ["case-custom-fields", projectId],
    queryFn: () => fetchCustomFieldsForUse(projectId, "case"),
    enabled: Boolean(projectId)
  });
  const { data: caseTemplates = [] } = useQuery({
    queryKey: ["case-templates", projectId],
    queryFn: () => fetchCaseTemplates(projectId),
    enabled: Boolean(projectId)
  });
  const [showAdd, setShowAdd] = useState(false);
  const [createSectionOverride, setCreateSectionOverride] = useState<number | null>(null);
  const effectiveCreateSectionId = createSectionOverride ?? createTargetSectionId;
  const createSectionPath =
    effectiveCreateSectionId != null ? sectionPathLabel(sections, effectiveCreateSectionId) : null;
  const [createFormVersion, setCreateFormVersion] = useState(0);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [createFormDirty, setCreateFormDirty] = useState(false);
  const [discardCreateOpen, setDiscardCreateOpen] = useState(false);
  const createEditorRef = useRef<HTMLDivElement>(null);
  const createReturnScrollRef = useRef<number | null>(null);
  const [searchDraft, setSearchDraft] = useState(caseFilters.q);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<number>>(new Set());
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(() => new Set());
  const selectionAnchorIndexRef = useRef<number | null>(null);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkOperationIds, setBulkOperationIds] = useState<number[] | null>(null);
  const [bulkOperationLabel, setBulkOperationLabel] = useState("");
  const [bulkUpdatePriority, setBulkUpdatePriority] = useState<BulkPriorityValue>("");
  const [bulkUpdateCaseType, setBulkUpdateCaseType] = useState<BulkCaseTypeValue>("");
  const [bulkRelocationOpen, setBulkRelocationOpen] = useState(false);
  const [relocationProjectId, setRelocationProjectId] = useState(projectId);
  const [relocationSuiteId, setRelocationSuiteId] = useState(suiteId);
  const [bulkRelocationTargetId, setBulkRelocationTargetId] = useState<number | null>(null);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<BulkCaseFeedback | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");

  const deferredSearch = useDeferredValue(searchDraft);
  const caseLabelById = useMemo(
    () => new Map(cases.map((row) => [row.id, `${row.caseCode} ${row.title}`])),
    [cases]
  );
  const validSectionIds = useMemo(() => new Set(sections.map((section) => section.id)), [sections]);
  const currentView = useMemo(
    () => ({
      sectionId: selectedSectionId,
      filters: caseFilters,
      columns: effectiveColumns,
      display: caseDisplay,
      groupBy: caseGroupBy,
      scope: caseQueryScope
    }),
    [caseDisplay, caseFilters, caseGroupBy, caseQueryScope, effectiveColumns, selectedSectionId]
  );
  const { savedViews, matchedSavedView, saveView, deleteView } = useCaseSavedViews(
    projectId,
    user?.id,
    currentView,
    validSectionIds
  );
  const workspacePrefsQuery = useWorkspacePreferences(projectId);
  const [defaultSavedViewRestored, setDefaultSavedViewRestored] = useState(false);

  useEffect(() => {
    if (hasRepositoryViewParams || defaultSavedViewRestored || validSectionIds.size === 0) return;
    const viewId = workspacePrefsQuery.data?.defaultSavedViewId;
    if (!viewId) return;
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    applySavedView({
      sectionId: view.sectionId,
      filters: view.filters,
      columns: view.columns,
      scope: view.scope
    });
    setDefaultSavedViewRestored(true);
  }, [
    applySavedView,
    defaultSavedViewRestored,
    hasRepositoryViewParams,
    savedViews,
    validSectionIds,
    workspacePrefsQuery.data?.defaultSavedViewId
  ]);

  useCaseLastViewState({
    projectId,
    suiteId,
    userId: user?.id,
    currentView,
    validSectionIds,
    hasExplicitUrlState: hasRepositoryViewParams || defaultSavedViewRestored,
    onRestore: (view) => applyRepositoryView(view, { replace: true })
  });

  const activeFilterCount = useMemo(
    () =>
      [
        caseFilters.q.trim().length > 0,
        caseFilters.priority !== "",
        caseFilters.caseType !== "",
        caseFilters.automation !== "",
        caseFilters.refs !== "",
        caseFilters.labels !== "",
        caseFilters.estimate !== "",
        caseFilters.state !== "active"
      ].filter(Boolean).length,
    [caseFilters]
  );
  const { data: allProjects = [] } = useProjectsQuery();
  const relocationSuitesQuery = useQuery({
    queryKey: ["relocation-suites", relocationProjectId],
    queryFn: () => fetchSuites(relocationProjectId),
    enabled: bulkRelocationOpen && Boolean(relocationProjectId)
  });
  const relocationSectionsQuery = useQuery({
    queryKey: ["relocation-sections", relocationProjectId, relocationSuiteId],
    queryFn: () => fetchSectionsForProject(relocationProjectId, { suiteId: relocationSuiteId }),
    enabled: bulkRelocationOpen && Boolean(relocationProjectId && relocationSuiteId)
  });
  const relocationTargetSections = useMemo(() => {
    const rows = [...(relocationSectionsQuery.data?.sections ?? [])].sort(
      (left, right) => left.displayOrder - right.displayOrder || left.id - right.id
    );
    const depthById = new Map<number, number>();
    const resolveDepth = (sectionId: number): number => {
      const cached = depthById.get(sectionId);
      if (cached != null) return cached;
      const section = rows.find((row) => row.id === sectionId);
      if (!section?.parentSectionId) {
        depthById.set(sectionId, 0);
        return 0;
      }
      const depth = resolveDepth(section.parentSectionId) + 1;
      depthById.set(sectionId, depth);
      return depth;
    };
    return rows.map((section) => ({
      id: section.id,
      name: section.name,
      depth: resolveDepth(section.id)
    }));
  }, [relocationSectionsQuery.data?.sections]);

  useEffect(() => {
    if (!bulkRelocationOpen) return;
    const suites = relocationSuitesQuery.data ?? [];
    if (suites.length === 0) return;
    setRelocationSuiteId((current) => {
      if (suites.some((row) => row.id === current)) return current;
      const preferred = suites.find((row) => row.isMaster) ?? suites[0];
      return preferred?.id ?? current;
    });
  }, [bulkRelocationOpen, relocationProjectId, relocationSuitesQuery.data]);

  const hasBulkUpdatePatch = bulkUpdatePriority !== "" || bulkUpdateCaseType !== "";
  const bulkArchiveMode = caseFilters.state === "archived" ? "restore" : "archive";
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId]
  );
  const sectionById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);
  const sectionDepthById = useMemo(() => {
    const depths = new Map<number, number>();
    const resolveDepth = (sectionId: number): number => {
      const existing = depths.get(sectionId);
      if (existing != null) return existing;
      const section = sectionById.get(sectionId);
      if (!section?.parentSectionId) {
        depths.set(sectionId, 0);
        return 0;
      }
      const depth = resolveDepth(section.parentSectionId) + 1;
      depths.set(sectionId, depth);
      return depth;
    };
    for (const section of sections) resolveDepth(section.id);
    return depths;
  }, [sectionById, sections]);
  const sectionGroupedCases = useMemo(() => {
    if (suiteCaseData?.groupBy === "section_id" && suiteCaseData.groups.length) {
      return suiteCaseData.groups
        .filter((group) => group.sectionId != null)
        .map((group) => ({
          sectionId: group.sectionId!,
          sectionName: group.groupLabel,
          cases: group.cases
        }));
    }
    const groups = new Map<number, typeof cases>();
    for (const item of cases) {
      const list = groups.get(item.sectionId);
      if (list) list.push(item);
      else groups.set(item.sectionId, [item]);
    }
    const sectionOrder = sortSectionIdsDepthFirst(
      sections.map((section) => ({
        id: section.id,
        parentSectionId: section.parentSectionId,
        displayOrder: section.displayOrder
      }))
    );
    const sectionRank = new Map(sectionOrder.map((sectionId, index) => [sectionId, index]));
    return Array.from(groups.entries())
      .sort(([leftId], [rightId]) => (sectionRank.get(leftId) ?? 999) - (sectionRank.get(rightId) ?? 999))
      .map(([sectionId, sectionCases]) => ({
        sectionId,
        sectionName: sectionById.get(sectionId)?.name ?? `Section ${sectionId}`,
        cases: sectionCases
      }));
  }, [cases, sectionById, sections, suiteCaseData?.groupBy, suiteCaseData?.groups]);
  const repositoryGroups = useMemo(() => {
    const groups =
      suiteCaseData?.groupBy === caseGroupBy && suiteCaseData.groups.length > 0
        ? mapFetchedSuiteGroups({
            groups: suiteCaseData.groups,
            groupBy: caseGroupBy,
            sectionDepthById
          })
        : regroupRepositoryCases({
            sectionGroups: sectionGroupedCases,
            groupBy: caseGroupBy,
            sectionDepthById
          });
    return caseGroupBy === "section_id" ? applySectionPathLabels(groups, sections) : groups;
  }, [caseGroupBy, sectionDepthById, sectionGroupedCases, sections, suiteCaseData?.groupBy, suiteCaseData?.groups]);
  const flatCases = useMemo(() => repositoryGroups.flatMap((group) => group.cases), [repositoryGroups]);
  const visibleCaseIds = useMemo(() => flatCases.map((item) => item.id), [flatCases]);
  const selectedVisibleCaseIds = useMemo(
    () => visibleCaseIds.filter((caseId) => selectedCaseIds.has(caseId)),
    [selectedCaseIds, visibleCaseIds]
  );
  const selectedCaseIdList = useMemo(() => Array.from(selectedCaseIds), [selectedCaseIds]);
  const bulkTargetCaseIds = bulkOperationIds ?? selectedCaseIdList;
  const allVisibleSelected = visibleCaseIds.length > 0 && selectedVisibleCaseIds.length === visibleCaseIds.length;
  const showGroupHeaders = shouldShowCaseGroupHeaders(caseGroupBy, caseDisplay);
  const navigableCaseIds = useMemo(() => flatCases.map((item) => item.id), [flatCases]);
  const selectedSectionPath = useMemo(() => {
    if (selectedSectionId == null) return "All sections";
    return sectionPathLabel(sections, selectedSectionId);
  }, [sections, selectedSectionId]);
  const [scopeNotice, setScopeNotice] = useState<string | null>(null);

  useEffect(() => {
    setSearchDraft(caseFilters.q);
  }, [caseFilters.q]);

  useEffect(() => {
    if (!showAdd && createFormError != null) {
      setCreateFormError(null);
    }
  }, [createFormError, showAdd]);

  useEffect(() => {
    if (addCaseRequest <= 0) return;
    setBulkFeedback(null);
    setCreateFormError(null);
    setCreateSectionOverride(null);
    setShowAdd(true);
    setCreateFormVersion((value) => value + 1);
  }, [addCaseRequest]);

  useEffect(() => {
    if (copyMoveRequest <= 0) return;
    setBulkFeedback(null);
    if (selectedCaseIds.size === 0) {
      setBulkFeedback({
        tone: "error",
        message: "Select at least one test case to copy or move."
      });
      return;
    }
    setRelocationProjectId(projectId);
    setRelocationSuiteId(suiteId);
    setBulkRelocationTargetId(null);
    setBulkRelocationOpen(true);
  }, [copyMoveRequest, projectId, selectedCaseIds.size, suiteId]);

  const renameCaseMutation = useMutation({
    mutationFn: (input: { caseId: number; title: string; lockVersion: number }) =>
      updateCase(input.caseId, { title: input.title.trim(), expectedVersion: input.lockVersion }),
    onSuccess: () => {
      invalidateCases();
    },
    onError: (error, input) => {
      setBulkFeedback({
        tone: "error",
        message: extractApiErrorMessage(error, `Could not rename case ${input.caseId}.`)
      });
    }
  });

  const quickUpdateCaseMutation = useMutation({
    mutationFn: (input: {
      caseId: number;
      lockVersion: number;
      patch: { priority?: "low" | "medium" | "high"; caseType?: "functional" | "integration" | "regression" };
    }) => updateCase(input.caseId, { ...input.patch, expectedVersion: input.lockVersion }),
    onSuccess: () => {
      invalidateCases();
    },
    onError: (error, input) => {
      setBulkFeedback({
        tone: "error",
        message: extractApiErrorMessage(error, `Could not update case ${input.caseId}.`)
      });
    }
  });

  useEffect(() => {
    if (!showAdd) return;
    if (createReturnScrollRef.current == null) createReturnScrollRef.current = window.scrollY;
    const frame = window.requestAnimationFrame(() =>
      createEditorRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
    );
    return () => window.cancelAnimationFrame(frame);
  }, [showAdd, createFormVersion]);

  useEffect(() => {
    const normalized = deferredSearch.trim();
    if (normalized !== caseFilters.q) {
      setCaseFilters({ q: normalized });
    }
  }, [caseFilters.q, deferredSearch, setCaseFilters]);

  useEffect(() => {
    setFocusCaseId(null);
  }, [caseDisplay, caseGroupBy, setFocusCaseId]);

  useEffect(() => {
    setCollapsedGroupKeys(expandAllGroupKeys());
  }, [projectId, suiteId]);

  useEffect(() => {
    if (isLoading || !suiteCaseData) return;
    const visibleIds = new Set(cases.map((row) => row.id));
    if (selectedCaseIds.size > 0) {
      const kept = [...selectedCaseIds].filter((id) => visibleIds.has(id));
      if (kept.length !== selectedCaseIds.size) {
        const removed = selectedCaseIds.size - kept.length;
        setSelectedCaseIds(new Set(kept));
        selectionAnchorIndexRef.current = null;
        setScopeNotice(`Cleared ${removed} selected case${removed === 1 ? "" : "s"} outside this scope.`);
      }
    }
    if (panelCaseId != null && !visibleIds.has(panelCaseId)) {
      setPanelCase(null);
      setScopeNotice((current) => current ?? "Closed the case detail because it is outside this scope.");
    }
  }, [cases, isLoading, panelCaseId, selectedCaseIds, setPanelCase, suiteCaseData]);

  useEffect(() => {
    if (panelCaseId != null) setFocusCaseId(panelCaseId);
  }, [panelCaseId, setFocusCaseId]);

  useEffect(() => {
    if (focusCaseId == null) return;
    document
      .querySelector(`[data-case-row-id="${focusCaseId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusCaseId, flatCases.length]);

  const scrollCaseIntoView = useCallback((caseId: number) => {
    document.querySelector(`[data-case-row-id="${caseId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (selectedSectionId == null || caseQueryScope !== "all") return;
    document
      .querySelector(`[data-section-group-id="${selectedSectionId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [caseQueryScope, selectedSectionId]);

  useCaseListKeyboardNav({
    enabled: flatCases.length > 0 && (caseQueryScope === "all" || selectedSectionId != null),
    caseIds: navigableCaseIds,
    activeCaseId: focusCaseId ?? panelCaseId,
    onFocusCase: (caseId) => {
      setFocusCaseId(caseId);
      scrollCaseIntoView(caseId);
    },
    onTogglePanel: (caseId) => {
      setFocusCaseId(caseId);
      togglePanelCase(caseId);
    },
    onClosePanel: () => {
      if (panelCaseId != null && panelMode === "edit") {
        setPanelCase(panelCaseId, "view");
        return;
      }
      setPanelCase(null);
    }
  });

  useEffect(() => {
    setBulkRelocationTargetId((current) => {
      if (current != null && relocationTargetSections.some((section) => section.id === current)) return current;
      return relocationTargetSections[0]?.id ?? null;
    });
  }, [relocationTargetSections]);

  const invalidateCases = (targetProjectId = projectId) => {
    void qc.invalidateQueries({ queryKey: caseKeys.all(targetProjectId) });
    void qc.invalidateQueries({ queryKey: ["suite-summary", targetProjectId] });
    void qc.invalidateQueries({ queryKey: sectionKeys.all(targetProjectId) });
    void qc.invalidateQueries({ queryKey: projectKeys.overview(targetProjectId) });
    void qc.invalidateQueries({ queryKey: reportKeys.all(targetProjectId) });
  };

  const createEditorDirty = createFormDirty;

  const closeCreateEditor = () => {
    const returnScroll = createReturnScrollRef.current;
    createReturnScrollRef.current = null;
    setShowAdd(false);
    setCreateSectionOverride(null);
    setCreateFormError(null);
    setCreateFormDirty(false);
    setDiscardCreateOpen(false);
    setCreateFormVersion((current) => current + 1);
    if (returnScroll != null) {
      window.requestAnimationFrame(() => window.scrollTo({ top: returnScroll, behavior: "auto" }));
    }
  };

  const openAddCaseForSection = (sectionId: number) => {
    if (isProjectArchived) return;
    setBulkFeedback(null);
    setCreateFormError(null);
    setCreateSectionOverride(sectionId);
    setShowAdd(true);
    setCreateFormVersion((value) => value + 1);
  };

  const createCaseMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      preconditions: string;
      estimate: string;
      references: string;
      expectedResult: string;
      stepsText: string;
      draftSteps: Array<{ description: string; expected: string }>;
      instructionKind: "text" | "steps" | "other";
      caseType: "Functional" | "Integration" | "Regression";
      priority: "High" | "Medium" | "Low";
      mission: string;
      goals: string;
      aiInput: string;
      aiExpectedOutput: string;
      templateId: string | null;
      customValues: Record<string, string | number | boolean | string[] | null>;
    }) => {
      if (effectiveCreateSectionId == null) {
        throw new Error("Select a section before adding a test case.");
      }
      const created = await createCase(effectiveCreateSectionId, {
        title: input.title,
        preconditions: input.preconditions,
        estimate: input.estimate.trim().length > 0 ? input.estimate.trim() : null,
        expectedResult: input.expectedResult.trim().length > 0 ? input.expectedResult.trim() : null,
        mission: input.mission.trim().length > 0 ? input.mission.trim() : null,
        goals: input.goals.trim().length > 0 ? input.goals.trim() : null,
        aiInput: input.aiInput.trim().length > 0 ? input.aiInput.trim() : null,
        aiExpectedOutput: input.aiExpectedOutput.trim().length > 0 ? input.aiExpectedOutput.trim() : null,
        caseTemplateId: input.templateId ? Number(input.templateId) : null,
        caseType: apiCaseTypeValue(input.caseType),
        priority: apiCasePriorityValue(input.priority),
        refs: input.references.trim().length > 0 ? input.references.trim() : null,
        customValues: input.customValues
      });
      const stepsToPersist =
        input.instructionKind === "text"
          ? draftStepsForTextPersist(input.stepsText).map(({ description, expected }) => ({ description, expected }))
          : input.instructionKind === "steps"
            ? input.draftSteps
            : [];
      let stepsWarning: string | null = null;
      try {
        await persistCreateDraftSteps(created.id, stepsToPersist);
      } catch (error) {
        stepsWarning = extractApiErrorMessage(error, "Could not save steps.");
      }
      return { created, stepsWarning };
    },
    onSuccess: ({ created, stepsWarning }) => {
      invalidateCases();
      closeCreateEditor();
      setPanelCase(created.id, "view");
      if (stepsWarning) {
        setBulkFeedback({
          tone: "partial",
          message: `Case was created, but saving one or more steps failed (${stepsWarning}). Open the case and add steps from edit mode.`
        });
      }
    },
    onError: (error) => {
      setCreateFormError(extractApiErrorMessage(error, "Could not create case."));
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (caseIds: number[]) => bulkDeleteCases(projectId, caseIds),
    onSuccess: (result) => {
      invalidateCases();
      const deletedIds = new Set(result.items.filter((item) => item.success).map((item) => Number(item.caseId)));
      setSelectedCaseIds((current) => new Set(Array.from(current).filter((caseId) => !deletedIds.has(caseId))));
      setBulkFeedback(
        buildBulkCaseFeedback({
          successCount: result.deleted,
          failedCount: result.failed,
          successLabel: "Deleted",
          failureLabel: "Could not delete",
          items: result.items,
          caseLabelById
        })
      );
      setBulkDeleteOpen(false);
    }
  });

  const bulkMoveMutation = useMutation({
    mutationFn: (input: { caseIds: number[]; targetSectionId: number }) =>
      bulkMoveCases(projectId, input.caseIds, input.targetSectionId),
    onSuccess: (result) => {
      invalidateCases();
      if (relocationProjectId !== projectId) {
        invalidateCases(relocationProjectId);
      }
      const movedIds = new Set(result.items.filter((item) => item.success).map((item) => Number(item.caseId)));
      setSelectedCaseIds((current) => new Set(Array.from(current).filter((caseId) => !movedIds.has(caseId))));
      setBulkFeedback(
        buildBulkCaseFeedback({
          successCount: result.moved,
          failedCount: result.failed,
          successLabel: "Moved",
          failureLabel: "Could not move",
          items: result.items,
          caseLabelById
        })
      );
      setBulkRelocationOpen(false);
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (input: { caseIds: number[]; patch: { priority?: string; caseType?: string } }) =>
      bulkUpdateCases(projectId, input.caseIds, input.patch),
    onSuccess: (result) => {
      invalidateCases();
      setBulkFeedback(
        buildBulkCaseFeedback({
          successCount: result.updated,
          failedCount: result.failed,
          successLabel: "Updated",
          failureLabel: "Could not update",
          items: result.items,
          caseLabelById
        })
      );
      setBulkUpdateOpen(false);
      setBulkOperationIds(null);
      setBulkOperationLabel("");
      setBulkUpdatePriority("");
      setBulkUpdateCaseType("");
    }
  });

  const closeBulkUpdateDialog = () => {
    setBulkUpdateOpen(false);
    setBulkOperationIds(null);
    setBulkOperationLabel("");
    setBulkUpdatePriority("");
    setBulkUpdateCaseType("");
  };

  const openBulkEditSelected = () => {
    if (selectedCaseIdList.length === 0) {
      setBulkFeedback({ tone: "error", message: "Select at least one case to edit." });
      return;
    }
    if (selectedCaseIdList.length === 1) {
      setShowAdd(false);
      setFocusCaseId(selectedCaseIdList[0]!);
      setPanelCase(selectedCaseIdList[0]!, "edit");
      return;
    }
    setBulkOperationIds(selectedCaseIdList);
    setBulkOperationLabel("selected");
    setBulkUpdateOpen(true);
  };

  const bulkArchiveMutation = useMutation({
    mutationFn: (input: { caseIds: number[]; archived: boolean }) =>
      bulkArchiveCases(projectId, input.caseIds, input.archived),
    onSuccess: (result) => {
      invalidateCases();
      const changedIds = new Set(result.items.filter((item) => item.success).map((item) => Number(item.caseId)));
      setSelectedCaseIds((current) => new Set(Array.from(current).filter((caseId) => !changedIds.has(caseId))));
      setBulkFeedback(
        buildBulkCaseFeedback({
          successCount: result.changed,
          failedCount: result.failed,
          successLabel: result.archived ? "Archived" : "Restored",
          failureLabel: "Could not change",
          items: result.items,
          caseLabelById
        })
      );
      setBulkArchiveOpen(false);
    }
  });

  const bulkCopyMutation = useMutation({
    mutationFn: (input: { caseIds: number[]; targetSectionId: number }) =>
      bulkCopyCases(projectId, input.caseIds, input.targetSectionId),
    onSuccess: (result) => {
      invalidateCases();
      if (relocationProjectId !== projectId) {
        invalidateCases(relocationProjectId);
      }
      setBulkFeedback(
        buildBulkCaseFeedback({
          successCount: result.copied,
          failedCount: result.failed,
          successLabel: "Copied",
          failureLabel: "Could not copy",
          items: result.items.map((item) => ({ caseId: item.sourceCaseId, success: item.success, error: item.error })),
          caseLabelById
        })
      );
      setBulkRelocationOpen(false);
    },
    onError: (error) => {
      setBulkFeedback({ tone: "error", message: extractApiErrorMessage(error, "Could not copy the selected cases.") });
    }
  });

  const positionCasesMutation = useMutation({
    mutationFn: (input: {
      sectionId: number;
      caseIds: number[];
      beforeCaseId?: number;
      afterCaseId?: number;
    }) =>
      positionCases(projectId, {
        sectionId: input.sectionId,
        caseIds: input.caseIds,
        ...(input.beforeCaseId !== undefined ? { beforeCaseId: input.beforeCaseId } : {}),
        ...(input.afterCaseId !== undefined ? { afterCaseId: input.afterCaseId } : {})
      }),
    onSuccess: (result, variables) => {
      invalidateCases();
      setBulkFeedback({
        tone: "success",
        message: `Reordered ${variables.caseIds.length} case${variables.caseIds.length === 1 ? "" : "s"} within the section (${result.updated} positions updated).`
      });
    },
    onError: (error) => {
      setBulkFeedback({ tone: "error", message: extractApiErrorMessage(error, "Could not reorder cases.") });
    }
  });

  const handleCaseSelectClick = (event: React.MouseEvent<HTMLInputElement>, caseId: number) => {
    if (!hasRangeMultiSelectModifier(event)) return;
    event.preventDefault();
    setBulkFeedback(null);
    const result = resolveRangeMultiSelectClick({
      orderedIds: visibleCaseIds,
      clickedId: caseId,
      selected: selectedCaseIds,
      anchorIndex: selectionAnchorIndexRef.current,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey
    });
    if (result.kind === "applied") {
      setSelectedCaseIds(result.selected);
      selectionAnchorIndexRef.current = result.anchorIndex;
    }
  };

  const toggleCaseSelection = (caseId: number, checked: boolean) => {
    setBulkFeedback(null);
    setSelectedCaseIds((current) => {
      const next = new Set(current);
      if (checked) next.add(caseId);
      else next.delete(caseId);
      return next;
    });
    const index = visibleCaseIds.indexOf(caseId);
    if (index >= 0) selectionAnchorIndexRef.current = index;
  };

  const toggleAllVisible = (checked: boolean) => {
    setBulkFeedback(null);
    setSelectedCaseIds((current) => {
      const next = new Set(current);
      for (const caseId of visibleCaseIds) {
        if (checked) next.add(caseId);
        else next.delete(caseId);
      }
      return next;
    });
  };

  const dndAnyMutationPending =
    bulkMoveMutation.isPending || bulkCopyMutation.isPending || positionCasesMutation.isPending;

  const dndPendingAction: "move" | "copy" | null = bulkMoveMutation.isPending
    ? "move"
    : bulkCopyMutation.isPending
      ? "copy"
      : null;

  const cancelPendingMoveCopy = () => {
    if (dndAnyMutationPending) return;
    onPendingMoveCopyChange?.(null);
  };

  const handleSamePositionDrop = (input: {
    caseIds: number[];
    sectionId: number;
    anchorCaseId: number;
    anchorPosition: "before" | "after";
  }) => {
    if (positionCasesMutation.isPending) return;
    setBulkFeedback(null);
    void positionCasesMutation.mutateAsync({
      sectionId: input.sectionId,
      caseIds: input.caseIds,
      ...(input.anchorPosition === "before"
        ? { beforeCaseId: input.anchorCaseId }
        : { afterCaseId: input.anchorCaseId })
    });
  };

  const handleSameSectionAppend = (input: { caseIds: number[]; sectionId: number }) => {
    if (positionCasesMutation.isPending) return;
    setBulkFeedback(null);
    void positionCasesMutation.mutateAsync({
      sectionId: input.sectionId,
      caseIds: input.caseIds
    });
  };

  const handleCrossSectionDrop = (pending: PendingMoveCopy) => {
    onPendingMoveCopyChange?.(pending);
  };

  const buildPendingPositionInput = (pending: PendingMoveCopy, caseIds: number[]) => {
    if (pending.anchorCaseId == null || pending.anchorPosition == null || caseIds.length === 0) return null;
    return {
      sectionId: pending.targetSectionId,
      caseIds,
      ...(pending.anchorPosition === "before"
        ? { beforeCaseId: pending.anchorCaseId }
        : { afterCaseId: pending.anchorCaseId })
    };
  };

  const handleMoveConfirm = () => {
    if (!pendingMoveCopy || dndAnyMutationPending) return;
    const pending = pendingMoveCopy;
    void (async () => {
      let committed = false;
      try {
        const result = await bulkMoveMutation.mutateAsync({
          caseIds: pending.caseIds,
          targetSectionId: pending.targetSectionId
        });
        committed = true;
        const movedCaseIds = result.items
          .filter((item) => item.success)
          .map((item) => Number(item.caseId))
          .filter((caseId) => Number.isInteger(caseId));
        const positionInput = buildPendingPositionInput(pending, movedCaseIds);
        if (positionInput) {
          await positionCasesMutation.mutateAsync(positionInput);
          setBulkFeedback({
            tone: "success",
            message: `Moved ${movedCaseIds.length} case${movedCaseIds.length === 1 ? "" : "s"} to the dropped position.`
          });
        }
      } finally {
        if (committed) onPendingMoveCopyChange?.(null);
      }
    })().catch(() => {
      // Mutation onError handlers surface the actionable message.
    });
  };

  const handleCopyConfirm = () => {
    if (!pendingMoveCopy || dndAnyMutationPending) return;
    const pending = pendingMoveCopy;
    void (async () => {
      let committed = false;
      try {
        const result = await bulkCopyMutation.mutateAsync({
          caseIds: pending.caseIds,
          targetSectionId: pending.targetSectionId
        });
        committed = true;
        const copiedCaseIds = result.items
          .filter((item) => item.success && item.copiedCaseId != null)
          .map((item) => Number(item.copiedCaseId))
          .filter((caseId) => Number.isInteger(caseId));
        const positionInput = buildPendingPositionInput(pending, copiedCaseIds);
        if (positionInput) {
          await positionCasesMutation.mutateAsync(positionInput);
          setBulkFeedback({
            tone: "success",
            message: `Copied ${copiedCaseIds.length} case${copiedCaseIds.length === 1 ? "" : "s"} to the dropped position.`
          });
        }
      } finally {
        if (committed) onPendingMoveCopyChange?.(null);
      }
    })().catch(() => {
      // Mutation onError handlers surface the actionable message.
    });
  };

  const targetSectionName = useMemo(() => {
    if (!pendingMoveCopy) return null;
    return sections.find((section) => section.id === pendingMoveCopy.targetSectionId)?.name ?? null;
  }, [pendingMoveCopy, sections]);

  const toolbarProps = {
    searchValue: searchDraft,
    onSearchChange: setSearchDraft,
    priorityValue: caseFilters.priority,
    onPriorityChange: (value: "low" | "medium" | "high" | "") => setCaseFilters({ priority: value }),
    caseTypeValue: caseFilters.caseType,
    onCaseTypeChange: (value: "functional" | "integration" | "regression" | "") =>
      setCaseFilters({ caseType: value }),
    automationValue: caseFilters.automation,
    onAutomationChange: (value: "manual" | "automated" | "") => setCaseFilters({ automation: value }),
    refsValue: caseFilters.refs,
    onRefsChange: (value: "with" | "without" | "") => setCaseFilters({ refs: value }),
    labelsValue: caseFilters.labels,
    onLabelsChange: (value: "with" | "without" | "") => setCaseFilters({ labels: value }),
    estimateValue: caseFilters.estimate,
    onEstimateChange: (value: "with" | "without" | "") => setCaseFilters({ estimate: value }),
    stateValue: caseFilters.state,
    onStateChange: (value: "active" | "archived") => setCaseFilters({ state: value }),
    groupByValue: caseGroupBy,
    onGroupByChange: setCaseGroupBy,
    columnsValue: effectiveColumns,
    columnWidths,
    activeFilterCount,
    onClearFilters: () => {
      setSearchDraft("");
      clearCaseFilters();
    },
    savedViews,
    matchedSavedViewId: matchedSavedView?.id ?? "",
    onSavedViewSelect: (viewId: string) => {
      const view = savedViews.find((item) => item.id === viewId);
      if (!view) return;
      const sectionId =
        view.sectionId != null && validSectionIds.has(view.sectionId) ? view.sectionId : null;
      applySavedView({ sectionId, filters: view.filters, columns: view.columns, scope: view.scope });
      setSaveViewOpen(false);
      setSaveViewName("");
    },
    saveViewOpen,
    saveViewName,
    onSaveViewNameChange: setSaveViewName,
    onToggleSaveView: () => {
      if (saveViewOpen) {
        setSaveViewOpen(false);
        setSaveViewName("");
        return;
      }
      setSaveViewName(matchedSavedView?.name ?? "");
      setSaveViewOpen(true);
    },
    onSaveView: () => {
      const nextView = saveView(saveViewName);
      if (!nextView) return;
      setSaveViewOpen(false);
      setSaveViewName("");
    },
    onCancelSaveView: () => {
      setSaveViewOpen(false);
      setSaveViewName("");
    },
    onDeleteSavedView: () => {
      if (!matchedSavedView) return;
      deleteView(matchedSavedView.id);
      setSaveViewOpen(false);
      setSaveViewName("");
    },
    selectedSectionLabel: selectedSection?.name,
    onColumnsChange: (columns) => {
      const next = persistColumns(columns);
      setCaseColumns(next);
    },
    onColumnWidthsChange: persistColumnWidths,
    density: uiDensity,
    onDensityChange: setUiDensity,
    onExpandAllGroups: () => {
      setCollapsedGroupKeys(expandAllGroupKeys());
    },
    onCollapseAllGroups: () => {
      setCollapsedGroupKeys(collapseAllGroupKeys(repositoryGroups.map((group) => group.key)));
    }
  } satisfies ComponentProps<typeof CaseRepositoryToolbar>;

  const clearFiltersAndSearch = () => {
    setSearchDraft("");
    clearCaseFilters();
  };

  const renderCaseRow = (item: TestCase) => {
    const isDraggingThis = dnd?.draggingCaseIds?.includes(item.id) ?? false;
    const dropIndicator = dnd?.hoveredRow?.caseId === item.id ? dnd.hoveredRow.position : null;
    return (
      <CaseRow
        key={item.id}
        projectId={projectId}
        item={item}
        isExpanded={false}
        isPanelOpen={panelCaseId === item.id}
        isKeyboardFocused={focusCaseId === item.id && panelCaseId !== item.id}
        mode="view"
        detail={item}
        versions={[]}
        customFields={customFields}
        caseTemplates={caseTemplates}
        visibleColumns={effectiveColumns}
        columnWidths={columnWidths}
        density={uiDensity}
        isSelected={selectedCaseIds.has(item.id)}
        onSelectChange={(checked) => toggleCaseSelection(item.id, checked)}
        onSelectClick={(event) => handleCaseSelectClick(event, item.id)}
        draggable={Boolean(dnd)}
        isDraggingThis={isDraggingThis}
        dropIndicator={dropIndicator}
        onRowDragStart={(event) => {
          if (!dnd) return;
          dnd.startCaseDrag(event, {
            caseId: item.id,
            sectionId: item.sectionId,
            selectedCaseIds
          });
        }}
        onRowDragEnd={() => dnd?.endCaseDrag()}
        onRowDragOver={(event) => dnd?.handleRowDragOver({ event, caseId: item.id })}
        onRowDragLeave={() => dnd?.handleRowDragLeave(item.id)}
        onRowDrop={(event) => {
          if (!dnd) return;
          dnd.handleRowDrop({
            event,
            targetCaseId: item.id,
            targetSectionId: item.sectionId,
            visibleCaseIds,
            onSamePositionDrop: handleSamePositionDrop,
            onCrossSectionDrop: handleCrossSectionDrop
          });
        }}
        onOpenCase={() => {
          setShowAdd(false);
          setFocusCaseId(item.id);
          setPanelCase(item.id, "view");
        }}
        onRenameTitle={
          item.archivedAt
            ? undefined
            : async (title) => {
                await renameCaseMutation.mutateAsync({
                  caseId: item.id,
                  title,
                  lockVersion: item.lockVersion
                });
              }
        }
        isRenamingTitle={renameCaseMutation.isPending && renameCaseMutation.variables?.caseId === item.id}
        onTogglePanel={() => {
          setShowAdd(false);
          setFocusCaseId(item.id);
          togglePanelCase(item.id);
        }}
        onEdit={() => {
          setShowAdd(false);
          setFocusCaseId(item.id);
          setPanelCase(item.id, "edit");
        }}
        onCloseDetail={() => {}}
        onSave={async () => {}}
        onDelete={async () => {}}
        renderDetailInline={false}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CaseRepositoryToolbar {...toolbarProps} />
        <div className="p-6">
          <LoadingState message="Loading the case repository..." />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <CaseRepositoryToolbar {...toolbarProps} />
        <p className="text-sm text-red-700">Could not load the case repository.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 text-sm font-medium text-slate-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <div>
        <section className="overflow-hidden border border-slate-300 bg-white">
          <div className="border-b border-slate-300 bg-[#f8f8f8] px-3 py-1.5">
            <CaseQueryScopeControl
              sectionPath={selectedSectionPath}
              scope={caseQueryScope}
              caseCount={cases.length}
              onScopeChange={setCaseQueryScope}
              selectAll={
                cases.length > 0
                  ? {
                      checked: allVisibleSelected,
                      indeterminate: selectedVisibleCaseIds.length > 0 && !allVisibleSelected,
                      onChange: toggleAllVisible
                    }
                  : undefined
              }
            />
            {scopeNotice ? (
              <p className="mt-1 text-xs text-slate-600" role="status">
                {scopeNotice}
              </p>
            ) : null}
          </div>
          <CaseRepositoryToolbar {...toolbarProps} />

          {showAdd ? (
            <div ref={createEditorRef} className="scroll-mt-3 border-b border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-1 text-lg font-semibold text-slate-900">New test case</h3>
              <CaseAuthoringForm
                projectId={projectId}
                valueKey={`create:${selectedSectionId ?? "none"}:${createFormVersion}`}
                sectionPath={createSectionPath}
                initialTitle=""
                initialPreconditions=""
                initialCustomValues={{}}
                customFields={customFields}
                templates={caseTemplates}
                submitLabel={createCaseMutation.isPending ? "Creating..." : "Create"}
                isSubmitting={createCaseMutation.isPending}
                submitError={createFormError}
                onDirtyChange={setCreateFormDirty}
                onSubmit={async (input) => {
                  setCreateFormError(null);
                  await createCaseMutation.mutateAsync({
                    title: input.title,
                    preconditions: input.preconditions,
                    estimate: input.estimate,
                    references: input.references,
                    expectedResult: input.expectedResult,
                    stepsText: input.stepsText,
                    draftSteps: input.draftSteps.map(({ description, expected }) => ({ description, expected })),
                    instructionKind: input.instructionKind,
                    caseType: input.caseType,
                    priority: input.priority,
                    mission: input.mission,
                    goals: input.goals,
                    aiInput: input.aiInput,
                    aiExpectedOutput: input.aiExpectedOutput,
                    templateId: input.templateId,
                    customValues: input.customValues
                  });
                }}
                onCancel={() => {
                  if (createEditorDirty) {
                    setDiscardCreateOpen(true);
                    return;
                  }
                  closeCreateEditor();
                }}
              />
            </div>
          ) : null}

          <CaseSelectionActionBar
            selectedCount={selectedCaseIds.size}
            loadedCount={visibleCaseIds.length}
            allLoadedSelected={allVisibleSelected}
            archiveMode={bulkArchiveMode}
            printHref={buildCasesPrintPath(projectId, selectedCaseIdList)}
            canCopyMove={sections.length > 0}
            readOnly={isProjectArchived}
            editBusy={bulkUpdateMutation.isPending}
            copyMoveBusy={bulkMoveMutation.isPending}
            archiveBusy={bulkArchiveMutation.isPending}
            deleteBusy={bulkDeleteMutation.isPending}
            bulkFeedback={bulkFeedback}
            onEdit={openBulkEditSelected}
            onClearSelection={() => {
              setBulkFeedback(null);
              setSelectedCaseIds(new Set());
            }}
            onSelectAllLoaded={() => toggleAllVisible(true)}
            onCopyMove={() => setBulkRelocationOpen(true)}
            onArchive={() => setBulkArchiveOpen(true)}
            onDeletePermanent={() => setBulkDeleteOpen(true)}
            onDismissFeedback={() => setBulkFeedback(null)}
          />

          {cases.length === 0 && !showAdd ? (
            <div className="px-3 py-4 text-sm text-slate-600">
              <p>
                {activeFilterCount > 0
                  ? "No cases match the current filters."
                  : caseQueryScopeEmptyTitle(caseQueryScope, caseFilters.state === "archived")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {activeFilterCount > 0
                  ? "Clear filters or choose another section."
                  : caseFilters.state === "archived"
                    ? "Archive cases from the active list or switch sections."
                    : "Use Add Case above, or pick another section."}
              </p>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-blue-700 underline"
                  onClick={clearFiltersAndSearch}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : showGroupHeaders ? (
            <div id="groupContainer">
              {repositoryGroups.map((group) => {
                const isSectionGroup = group.sectionId != null && caseGroupBy === "section_id";
                const collapsed = collapsedGroupKeys.has(group.key);
                const blockId = `case-section-block-${group.key}`;
                const hiddenSelected = collapsedHiddenSelectedCount(
                  collapsed,
                  selectedCaseIds,
                  group.cases.map((item) => item.id)
                );
                return (
                  <div key={group.key} className="border-b border-slate-200 last:border-b-0">
                    {group.label ? (
                      <div
                        className="px-3 py-1.5 text-xs font-semibold text-slate-800"
                        {...(isSectionGroup && group.sectionId != null
                          ? { "data-section-group-id": group.sectionId }
                          : {})}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            aria-expanded={!collapsed}
                            aria-controls={blockId}
                            aria-label={sectionBlockToggleLabel(group.label, collapsed)}
                            onClick={() => setCollapsedGroupKeys((current) => toggleCollapsedGroupKey(current, group.key))}
                          >
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                              <path
                                d={collapsed ? "M6 4l4 4-4 4" : "M4 6l4 4 4-4"}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          {isSectionGroup && group.sectionId != null ? (
                            <button
                              type="button"
                              className="min-w-0 flex-1 whitespace-normal break-words text-left text-blue-800 hover:underline"
                              onClick={() => {
                                if (caseQueryScope === "all") setTreeFocusSection(group.sectionId!);
                                else setSelectedSection(group.sectionId!);
                                setShowAdd(false);
                              }}
                            >
                              {group.label}
                            </button>
                          ) : (
                            <span className="min-w-0 flex-1 whitespace-normal break-words">{group.label}</span>
                          )}
                          <span className="shrink-0 pt-0.5 text-right font-normal text-slate-600">
                            {hiddenSelected > 0 ? `${hiddenSelected} selected · ` : null}
                            {group.cases.length} case{group.cases.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <div id={blockId} hidden={collapsed}>
                      {group.cases.map((item) => renderCaseRow(item))}
                      {isSectionGroup && group.sectionId != null && !isProjectArchived && caseFilters.state !== "archived" ? (
                        <div className="px-3 pb-2 pt-1">
                          <button
                            type="button"
                            className="inline-flex min-h-8 items-center rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            aria-label={sectionBlockAddCaseLabel(group.label)}
                            onClick={() => openAddCaseForSection(group.sectionId!)}
                          >
                            Add Case
                          </button>
                        </div>
                      ) : null}
                      {dnd?.isDragging && isSectionGroup && group.sectionId != null ? (
                        <div
                          className={[
                            "border-t border-dashed",
                            dnd.hoveredAppendZone ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-slate-50",
                            "px-4 py-3 text-center text-xs text-slate-600"
                          ].join(" ")}
                          onDragOver={(event) => dnd.handleAppendDragOver(event)}
                          onDragLeave={() => dnd.handleAppendDragLeave()}
                          onDrop={(event) =>
                            dnd.handleAppendDrop({
                              event,
                              currentSectionId: group.sectionId!,
                              onSameSectionAppend: handleSameSectionAppend,
                              onCrossSectionDrop: handleCrossSectionDrop
                            })
                          }
                        >
                          Drop here to append {dnd.draggingCount} case{dnd.draggingCount === 1 ? "" : "s"}
                          {dnd.sourceSectionId === group.sectionId
                            ? " to the end of this section"
                            : " into this section"}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              {flatCases.map((item) => renderCaseRow(item))}
              {dnd?.isDragging && createTargetSectionId != null ? (
                <div
                  className={[
                    "border-t border-dashed",
                    dnd.hoveredAppendZone ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-slate-50",
                    "px-4 py-3 text-center text-xs text-slate-600"
                  ].join(" ")}
                  onDragOver={(event) => dnd.handleAppendDragOver(event)}
                  onDragLeave={() => dnd.handleAppendDragLeave()}
                  onDrop={(event) =>
                    dnd.handleAppendDrop({
                      event,
                      currentSectionId: createTargetSectionId,
                      onSameSectionAppend: handleSameSectionAppend,
                      onCrossSectionDrop: handleCrossSectionDrop
                    })
                  }
                >
                  Drop here to append {dnd.draggingCount} case{dnd.draggingCount === 1 ? "" : "s"}
                  {dnd.sourceSectionId === createTargetSectionId
                    ? " to the end of this section"
                    : " into this section"}
                </div>
              ) : null}
            </div>
          )}
        </section>

      </div>

      <ConfirmDialog
        open={discardCreateOpen}
        title="Discard unsaved case?"
        description="Your changes to this new test case will be lost."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        variant="danger"
        onCancel={() => setDiscardCreateOpen(false)}
        onConfirm={closeCreateEditor}
      />

      <ConfirmDialog
        open={bulkUpdateOpen}
        title="Update test cases?"
        description={
          <div className="space-y-3">
            <p>
              Apply shared field changes to {bulkTargetCaseIds.length} test case
              {bulkTargetCaseIds.length === 1 ? "" : "s"}
              {bulkOperationLabel ? ` in the ${bulkOperationLabel}` : ""}.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Priority
              </span>
              <select
                value={bulkUpdatePriority}
                onChange={(e) => setBulkUpdatePriority(e.target.value as BulkPriorityValue)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Keep current priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Type
              </span>
              <select
                value={bulkUpdateCaseType}
                onChange={(e) => setBulkUpdateCaseType(e.target.value as BulkCaseTypeValue)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Keep current type</option>
                <option value="functional">Functional</option>
                <option value="integration">Integration</option>
                <option value="regression">Regression</option>
              </select>
            </label>
          </div>
        }
        confirmLabel={bulkUpdateMutation.isPending ? "Updating..." : "Update cases"}
        confirmDisabled={
          bulkUpdateMutation.isPending || bulkTargetCaseIds.length === 0 || !hasBulkUpdatePatch
        }
        onCancel={closeBulkUpdateDialog}
        onConfirm={() => {
          const patch: { priority?: string; caseType?: string } = {};
          if (bulkUpdatePriority) patch.priority = bulkUpdatePriority;
          if (bulkUpdateCaseType) patch.caseType = bulkUpdateCaseType;
          void bulkUpdateMutation.mutateAsync({
            caseIds: bulkTargetCaseIds,
            patch
          });
        }}
      />

      <CaseBulkRelocationDialog
        open={bulkRelocationOpen}
        caseCount={selectedCaseIdList.length}
        sourceProjectId={projectId}
        targetProjectId={relocationProjectId}
        targetSuiteId={relocationSuiteId}
        targetSectionId={bulkRelocationTargetId}
        projects={allProjects.map((row) => ({ id: row.id, name: row.name }))}
        suites={(relocationSuitesQuery.data ?? []).map((row) => ({ id: row.id, name: row.name }))}
        sections={relocationTargetSections}
        onTargetProjectChange={(nextProjectId) => {
          setRelocationProjectId(nextProjectId);
          setBulkRelocationTargetId(null);
        }}
        onTargetSuiteChange={(nextSuiteId) => {
          setRelocationSuiteId(nextSuiteId);
          setBulkRelocationTargetId(null);
        }}
        onTargetSectionChange={setBulkRelocationTargetId}
        busy={bulkMoveMutation.isPending || bulkCopyMutation.isPending}
        pendingAction={dndPendingAction}
        onCancel={() => setBulkRelocationOpen(false)}
        onMove={() => {
          if (bulkRelocationTargetId == null) return;
          void bulkMoveMutation.mutateAsync({
            caseIds: selectedCaseIdList,
            targetSectionId: bulkRelocationTargetId
          });
        }}
        onCopy={() => {
          if (bulkRelocationTargetId == null) return;
          void bulkCopyMutation.mutateAsync({
            caseIds: selectedCaseIdList,
            targetSectionId: bulkRelocationTargetId
          });
        }}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        title={
          bulkArchiveMode === "archive"
            ? caseDeleteCopy.markDeletedBulkTitle
            : caseDeleteCopy.undeleteBulkTitle
        }
        description={
          <span>
            {selectedCaseIdList.length} selected test case{selectedCaseIdList.length === 1 ? "" : "s"} will be{" "}
            {bulkArchiveMode === "archive"
              ? "marked as deleted and hidden from the active repository"
              : "restored to the active repository"}
            .
          </span>
        }
        confirmLabel={
          bulkArchiveMutation.isPending
            ? bulkArchiveMode === "archive"
              ? "Marking…"
              : "Restoring…"
            : bulkArchiveMode === "archive"
              ? caseDeleteCopy.markDeletedConfirm
              : caseDeleteCopy.undeleteConfirm
        }
        confirmDisabled={bulkArchiveMutation.isPending || selectedCaseIdList.length === 0}
        onCancel={() => setBulkArchiveOpen(false)}
        onConfirm={() =>
          void bulkArchiveMutation.mutateAsync({
            caseIds: selectedCaseIdList,
            archived: bulkArchiveMode === "archive"
          })
        }
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={caseDeleteCopy.permanentBulkTitle}
        description={
          <span>
            {caseDeleteCopy.permanentBulkDescription} ({selectedCaseIdList.length} selected test case
            {selectedCaseIdList.length === 1 ? "" : "s"}.)
          </span>
        }
        variant="danger"
        confirmLabel={bulkDeleteMutation.isPending ? "Deleting…" : caseDeleteCopy.permanentConfirm}
        confirmDisabled={bulkDeleteMutation.isPending || selectedCaseIdList.length === 0}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void bulkDeleteMutation.mutateAsync(selectedCaseIdList)}
      />

      <MoveCopyChooserDialog
        open={pendingMoveCopy != null}
        title="Move or copy dropped cases?"
        description={
          pendingMoveCopy ? (
            <div className="space-y-2">
              <p>
                {pendingMoveCopy.caseIds.length} case{pendingMoveCopy.caseIds.length === 1 ? "" : "s"} dropped on{" "}
                <span className="font-medium">{targetSectionName ?? "the target section"}</span>.
              </p>
              <p className="text-xs text-slate-500">
                Move keeps a single copy in the new section. Copy clones the cases, keeping the originals in place. The new
                position follows the drop target when you drop on a case row, otherwise it appends to the target section.
              </p>
            </div>
          ) : null
        }
        busy={dndAnyMutationPending}
        pendingAction={dndPendingAction}
        onCancel={cancelPendingMoveCopy}
        onMove={handleMoveConfirm}
        onCopy={handleCopyConfirm}
      />
    </>
  );
}
