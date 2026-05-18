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
import { Link, useNavigate } from "react-router-dom";
import { buildCasesPrintPath } from "../../print/api/printApi";

import {
  hasRangeMultiSelectModifier,
  resolveRangeMultiSelectClick
} from "../../../shared/selection/rangeMultiSelect";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchCaseTemplates, fetchCustomFieldsForUse } from "../../projects/api/settingsApi";
import { fetchSuites } from "../../projects/api/suitesApi";
import { projectKeys, useProjectsQuery } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import {
  bulkArchiveCases,
  bulkCopyCases,
  bulkDeleteCases,
  bulkMoveCases,
  bulkUpdateCases,
  updateCase,
  createCase,
  createCaseStep,
  fetchAllCasesForSection,
  fetchSectionsForProject,
  positionCases
} from "../api/catalogApi";
import { sectionScopeForDisplay } from "../caseRepositoryView";
import { buildCaseDetailPath } from "../caseRoute";
import { extractApiErrorMessage } from "../caseErrors";
import type { BulkCaseFeedback } from "../utils/bulkCaseFeedback";
import { buildBulkCaseFeedback } from "../utils/bulkCaseFeedback";
import { BulkCaseResultBanner } from "./BulkCaseResultBanner";
import type { CaseListDnD, PendingMoveCopy } from "../hooks/useCaseListDnD";
import { useCaseListKeyboardNav } from "../hooks/useCaseListKeyboardNav";
import { useCaseColumnPreferences } from "../hooks/useCaseColumnPreferences";
import { useCaseSavedViews } from "../hooks/useCaseSavedViews";
import { caseKeys } from "../hooks/useCases";
import { useSuiteCases } from "../hooks/useSuiteCases";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { sectionKeys } from "../hooks/useSections";
import type { SectionNode, TestCase } from "../types";
import { CaseAuthoringForm } from "./CaseAuthoringForm";
import { CaseBulkRelocationDialog } from "./CaseBulkRelocationDialog";
import { CaseRepositoryToolbar, type BulkEditScope } from "./CaseRepositoryToolbar";
import { CaseRow } from "./CaseRow";
import { MoveCopyChooserDialog } from "./MoveCopyChooserDialog";
import {
  buildSectionOnlyFilters,
  hasActiveCaseListFilters,
  mergeNumericIds
} from "../utils/caseListSelection";
import { caseDeleteCopy } from "../caseDeleteCopy";
import { mapFetchedSuiteGroups, regroupRepositoryCases } from "../utils/caseRepositoryGrouping";
import { sortSectionIdsDepthFirst } from "../utils/sectionTreeOrder";

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

type CaseCreateDraftStep = { key: string; description: string; expected: string };

function newCreateDraftStepKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyCreateDraftStep(): CaseCreateDraftStep {
  return { key: newCreateDraftStepKey(), description: "", expected: "" };
}

function initialCreateDraftSteps(): CaseCreateDraftStep[] {
  return [emptyCreateDraftStep()];
}

async function persistCreateDraftSteps(
  caseId: number,
  drafts: Array<{ description: string; expected: string }>
): Promise<void> {
  let posted = 0;
  for (const row of drafts) {
    const content = row.description.trim();
    const expected = row.expected.trim();
    if (content.length > 0) {
      await createCaseStep(caseId, {
        content,
        expectedResult: expected.length > 0 ? expected : null
      });
      posted += 1;
    } else if (expected.length > 0) {
      await createCaseStep(caseId, { content: "-", expectedResult: expected });
      posted += 1;
    }
  }
  if (posted === 0 && drafts.length === 1) {
    await createCaseStep(caseId, { content: "New step", expectedResult: null });
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    selectedSectionId,
    panelCaseId,
    caseDisplay,
    caseGroupBy,
    caseFilters,
    caseColumns,
    setCaseFilters,
    setCaseColumns,
    setCaseGroupBy,
    clearCaseFilters,
    applySavedView,
    togglePanelCase,
    setPanelCase,
    setSelectedSection,
    setTreeFocusSection
  } = useExpandedCase();

  const repositoryCaseFilters = useMemo(
    () => ({ ...caseFilters, sectionScope: sectionScopeForDisplay(caseDisplay) }),
    [caseFilters, caseDisplay]
  );
  const suiteFetchSectionId = caseDisplay === "tree" ? selectedSectionId : null;
  const { effectiveColumns, persistColumns } = useCaseColumnPreferences(projectId, suiteId, caseColumns);
  const { data: suiteCaseData, isLoading, isError, refetch } = useSuiteCases(
    projectId,
    suiteId,
    suiteFetchSectionId,
    repositoryCaseFilters,
    caseDisplay,
    caseGroupBy
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
  const [createFormVersion, setCreateFormVersion] = useState(0);
  const [createDraftSteps, setCreateDraftSteps] = useState<CaseCreateDraftStep[]>(initialCreateDraftSteps);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(caseFilters.q);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<number>>(new Set());
  const selectionAnchorIndexRef = useRef<number | null>(null);
  const [selectAllBusy, setSelectAllBusy] = useState(false);
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
  const [focusedCaseId, setFocusedCaseId] = useState<number | null>(null);

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
      columns: caseColumns
    }),
    [caseColumns, caseFilters, selectedSectionId]
  );
  const { savedViews, matchedSavedView, saveView, deleteView } = useCaseSavedViews(
    projectId,
    user?.id,
    currentView,
    validSectionIds
  );

  const listFiltersActive = hasActiveCaseListFilters(caseFilters);
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
    if (suiteCaseData?.groupBy === caseGroupBy && suiteCaseData.groups.length > 0) {
      return mapFetchedSuiteGroups({
        groups: suiteCaseData.groups,
        groupBy: caseGroupBy,
        sectionDepthById
      });
    }
    return regroupRepositoryCases({
      sectionGroups: sectionGroupedCases,
      groupBy: caseGroupBy,
      sectionDepthById
    });
  }, [caseGroupBy, sectionDepthById, sectionGroupedCases, suiteCaseData?.groupBy, suiteCaseData?.groups]);
  const flatCases = useMemo(() => repositoryGroups.flatMap((group) => group.cases), [repositoryGroups]);
  const visibleCaseIds = useMemo(() => flatCases.map((item) => item.id), [flatCases]);
  const selectedVisibleCaseIds = useMemo(
    () => visibleCaseIds.filter((caseId) => selectedCaseIds.has(caseId)),
    [selectedCaseIds, visibleCaseIds]
  );
  const selectedCaseIdList = useMemo(() => Array.from(selectedCaseIds), [selectedCaseIds]);
  const bulkTargetCaseIds = bulkOperationIds ?? selectedCaseIdList;
  const allVisibleSelected = visibleCaseIds.length > 0 && selectedVisibleCaseIds.length === visibleCaseIds.length;
  const showGroupHeaders =
    caseGroupBy !== "none" && !(caseDisplay === "compact" && caseGroupBy === "section_id");
  const navigableCaseIds = useMemo(() => flatCases.map((item) => item.id), [flatCases]);
  const listSummary = useMemo(() => {
    const stateLabel = caseFilters.state === "archived" ? "archived" : "active";
    if (caseDisplay === "tree") {
      return `${cases.length} case${cases.length === 1 ? "" : "s"} in this section (${stateLabel}).`;
    }
    if (caseDisplay === "compact") {
      return `${cases.length} case${cases.length === 1 ? "" : "s"} in the section subtree (${stateLabel}, compact list).`;
    }
    return `${cases.length} visible case${cases.length === 1 ? "" : "s"} across ${repositoryGroups.length} group${repositoryGroups.length === 1 ? "" : "s"} in the ${stateLabel} repository.`;
  }, [caseDisplay, caseFilters.state, cases.length, repositoryGroups.length]);
  const openCasePage = (caseId: number, edit = false) => {
    navigate(
      buildCaseDetailPath(projectId, caseId, {
        sectionId: selectedSectionId,
        mode: edit ? "edit" : "view"
      })
    );
  };

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

  useEffect(() => {
    if (!showAdd) return;
    setCreateDraftSteps(initialCreateDraftSteps());
  }, [showAdd, createFormVersion]);

  useEffect(() => {
    const normalized = deferredSearch.trim();
    if (normalized !== caseFilters.q) {
      setCaseFilters({ q: normalized });
    }
  }, [caseFilters.q, deferredSearch, setCaseFilters]);

  useEffect(() => {
    setSelectedCaseIds(new Set());
    selectionAnchorIndexRef.current = null;
    setFocusedCaseId(null);
  }, [selectedSectionId, caseDisplay, caseGroupBy]);

  useEffect(() => {
    if (panelCaseId != null) setFocusedCaseId(panelCaseId);
  }, [panelCaseId]);

  const scrollCaseIntoView = useCallback((caseId: number) => {
    document.querySelector(`[data-case-row-id="${caseId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (selectedSectionId == null || caseDisplay === "tree") return;
    document
      .querySelector(`[data-section-group-id="${selectedSectionId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [caseDisplay, selectedSectionId]);

  useCaseListKeyboardNav({
    enabled: flatCases.length > 0 && (caseDisplay !== "tree" || selectedSectionId != null),
    caseIds: navigableCaseIds,
    activeCaseId: focusedCaseId ?? panelCaseId,
    onFocusCase: (caseId) => {
      setFocusedCaseId(caseId);
      scrollCaseIntoView(caseId);
    },
    onTogglePanel: (caseId) => {
      setFocusedCaseId(caseId);
      togglePanelCase(caseId);
    },
    onClosePanel: () => setPanelCase(null)
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

  const [createUsesSteps, setCreateUsesSteps] = useState(false);

  const createCaseMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      preconditions: string;
      estimate: string;
      references: string;
      expectedResult: string;
      mission: string;
      goals: string;
      aiInput: string;
      aiExpectedOutput: string;
      templateId: string | null;
      customValues: Record<string, string | number | boolean | string[] | null>;
      draftSteps: Array<{ description: string; expected: string }>;
    }) => {
      if (createTargetSectionId == null) {
        throw new Error("Select a section before adding a test case.");
      }
      const created = await createCase(createTargetSectionId, {
        title: input.title,
        preconditions: input.preconditions,
        estimate: input.estimate.trim().length > 0 ? input.estimate.trim() : null,
        expectedResult: input.expectedResult.trim().length > 0 ? input.expectedResult.trim() : null,
        mission: input.mission.trim().length > 0 ? input.mission.trim() : null,
        goals: input.goals.trim().length > 0 ? input.goals.trim() : null,
        aiInput: input.aiInput.trim().length > 0 ? input.aiInput.trim() : null,
        aiExpectedOutput: input.aiExpectedOutput.trim().length > 0 ? input.aiExpectedOutput.trim() : null,
        caseTemplateId: input.templateId ? Number(input.templateId) : null,
        refs: input.references.trim().length > 0 ? input.references.trim() : null,
        customValues: input.customValues
      });
      let stepsWarning: string | null = null;
      try {
        await persistCreateDraftSteps(created.id, input.draftSteps);
      } catch (error) {
        stepsWarning = extractApiErrorMessage(error, "Could not save steps.");
      }
      return { created, stepsWarning };
    },
    onSuccess: ({ created, stepsWarning }) => {
      invalidateCases();
      setShowAdd(false);
      setCreateFormError(null);
      setCreateFormVersion((current) => current + 1);
      openCasePage(created.id);
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

  const openBulkUpdateWithScope = async (scope: BulkEditScope) => {
    if (selectedSectionId == null) return;
    if (scope === "selected") {
      if (selectedCaseIdList.length === 0) {
        setBulkFeedback({ tone: "error", message: "Select at least one case to edit." });
        return;
      }
      setBulkOperationIds(selectedCaseIdList);
      setBulkOperationLabel("selected");
      setBulkUpdateOpen(true);
      return;
    }
    if (scope === "view") {
      if (flatCases.length === 0) {
        setBulkFeedback({ tone: "error", message: "No cases in the current view." });
        return;
      }
      setBulkOperationIds(flatCases.map((item) => item.id));
      setBulkOperationLabel("current view");
      setBulkUpdateOpen(true);
      return;
    }
    setSelectAllBusy(true);
    try {
      const rows = await fetchAllCasesForSection(projectId, selectedSectionId, repositoryCaseFilters);
      if (rows.length === 0) {
        setBulkFeedback({ tone: "error", message: "No cases match the current filter." });
        return;
      }
      setBulkOperationIds(rows.map((row) => row.id));
      setBulkOperationLabel("filter");
      setBulkUpdateOpen(true);
    } catch (error) {
      setBulkFeedback({
        tone: "error",
        message: extractApiErrorMessage(error, "Could not load cases matching the filter.")
      });
    } finally {
      setSelectAllBusy(false);
    }
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

  const selectAllInSection = async () => {
    if (selectedSectionId == null || selectAllBusy) return;
    setSelectAllBusy(true);
    setBulkFeedback(null);
    try {
      const rows = await fetchAllCasesForSection(
        projectId,
        selectedSectionId,
        buildSectionOnlyFilters(caseFilters)
      );
      setSelectedCaseIds(mergeNumericIds(new Set(), rows.map((row) => row.id)));
    } catch (error) {
      setBulkFeedback({
        tone: "error",
        message: extractApiErrorMessage(error, "Could not select all cases in this section.")
      });
    } finally {
      setSelectAllBusy(false);
    }
  };

  const selectAllMatchingFilter = async () => {
    if (selectedSectionId == null || selectAllBusy) return;
    setSelectAllBusy(true);
    setBulkFeedback(null);
    try {
      const rows = await fetchAllCasesForSection(projectId, selectedSectionId, repositoryCaseFilters);
      setSelectedCaseIds(mergeNumericIds(new Set(), rows.map((row) => row.id)));
    } catch (error) {
      setBulkFeedback({
        tone: "error",
        message: extractApiErrorMessage(error, "Could not select all cases matching the filter.")
      });
    } finally {
      setSelectAllBusy(false);
    }
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
      applySavedView({ sectionId, filters: view.filters, columns: view.columns });
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
    onAddCase: () => {
      setBulkFeedback(null);
      setCreateFormError(null);
      setShowAdd(true);
      setCreateFormVersion((value) => value + 1);
    },
    selectedSectionLabel: selectedSection?.name,
    onColumnsChange: (columns) => {
      const next = persistColumns(columns);
      setCaseColumns(next);
    },
    onBulkEditScope: (scope) => void openBulkUpdateWithScope(scope),
    selectedCaseCount: selectedCaseIds.size,
    visibleCaseCount: flatCases.length,
    filterScopeBusy: selectAllBusy
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
        item={item}
        isExpanded={false}
        isPanelOpen={panelCaseId === item.id}
        isKeyboardFocused={focusedCaseId === item.id && panelCaseId !== item.id}
        mode="view"
        detail={item}
        versions={[]}
        customFields={customFields}
        caseTemplates={caseTemplates}
        visibleColumns={effectiveColumns}
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
          setFocusedCaseId(item.id);
          openCasePage(item.id);
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
        isRenamingTitle={renameCaseMutation.isPending}
        onTogglePanel={() => {
          setShowAdd(false);
          setFocusedCaseId(item.id);
          togglePanelCase(item.id);
        }}
        onEdit={() => {
          setShowAdd(false);
          setFocusedCaseId(item.id);
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
        <section className="overflow-hidden border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-300 bg-[#f8f8f8] px-3 py-1.5 text-xs text-slate-600">{listSummary}</div>
          <CaseRepositoryToolbar {...toolbarProps} />

          {showAdd ? (
            <div className="border-b border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">New test case</h3>
              <CaseAuthoringForm
                projectId={projectId}
                valueKey={`create:${selectedSectionId ?? "none"}:${createFormVersion}`}
                initialTitle=""
                initialPreconditions=""
                initialCustomValues={{}}
                customFields={customFields}
                templates={caseTemplates}
                onTemplateChange={({ usesSteps }) => setCreateUsesSteps(usesSteps)}
                submitLabel={createCaseMutation.isPending ? "Creating..." : "Create"}
                isSubmitting={createCaseMutation.isPending}
                submitError={createFormError}
                stepsSection={createUsesSteps ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">Steps</span>
                      <button
                        type="button"
                        disabled={createCaseMutation.isPending}
                        className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        onClick={() => setCreateDraftSteps((prev) => [...prev, emptyCreateDraftStep()])}
                      >
                        Add step
                      </button>
                    </div>
                    <ol className="list-decimal space-y-3 pl-5 text-sm">
                      {createDraftSteps.map((step) => (
                        <li key={step.key} className="grid gap-2 rounded-md border border-slate-200 bg-white p-2">
                          <div className="flex flex-wrap items-center gap-1">
                            {createDraftSteps.length > 1 ? (
                              <button
                                type="button"
                                disabled={createCaseMutation.isPending}
                                className="ml-auto rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-800 disabled:opacity-50"
                                onClick={() =>
                                  setCreateDraftSteps((prev) => prev.filter((row) => row.key !== step.key))
                                }
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                          <label className="grid gap-0.5 text-xs text-slate-600">
                            Action
                            <textarea
                              value={step.description}
                              disabled={createCaseMutation.isPending}
                              onChange={(e) => {
                                const value = e.target.value;
                                setCreateDraftSteps((prev) =>
                                  prev.map((row) =>
                                    row.key === step.key ? { ...row, description: value } : row
                                  )
                                );
                              }}
                              className="min-h-[56px] rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          </label>
                          <label className="grid gap-0.5 text-xs text-slate-600">
                            Expected
                            <textarea
                              value={step.expected}
                              disabled={createCaseMutation.isPending}
                              onChange={(e) => {
                                const value = e.target.value;
                                setCreateDraftSteps((prev) =>
                                  prev.map((row) =>
                                    row.key === step.key ? { ...row, expected: value } : row
                                  )
                                );
                              }}
                              className="min-h-[44px] rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                            />
                          </label>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : undefined}
                onSubmit={async (input) => {
                  setCreateFormError(null);
                  await createCaseMutation.mutateAsync({
                    title: input.title,
                    preconditions: input.preconditions,
                    estimate: input.estimate,
                    references: input.references,
                    expectedResult: input.expectedResult,
                    mission: input.mission,
                    goals: input.goals,
                    aiInput: input.aiInput,
                    aiExpectedOutput: input.aiExpectedOutput,
                    templateId: input.templateId,
                    customValues: input.customValues,
                    draftSteps: createUsesSteps
                      ? createDraftSteps.map(({ description, expected }) => ({ description, expected }))
                      : []
                  });
                }}
                onCancel={() => {
                  setShowAdd(false);
                  setCreateFormError(null);
                  setCreateFormVersion((current) => current + 1);
                }}
              />
            </div>
          ) : null}

          {cases.length > 0 ? (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      title="Select all cases loaded in the list"
                    />
                    Select loaded
                  </label>
                  {selectedSectionId != null ? (
                    <button
                      type="button"
                      disabled={selectAllBusy}
                      className="text-sm font-medium text-sky-700 underline hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void selectAllInSection()}
                    >
                      {selectAllBusy ? "Selecting…" : "Select all in section"}
                    </button>
                  ) : null}
                  {listFiltersActive ? (
                    <button
                      type="button"
                      disabled={selectAllBusy}
                      className="text-sm font-medium text-sky-700 underline hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void selectAllMatchingFilter()}
                    >
                      {selectAllBusy ? "Selecting…" : "Select all matching filter"}
                    </button>
                  ) : null}
                </div>
                {selectedCaseIds.size > 0 ? (
                  <div className="text-sm text-slate-600">{selectedCaseIds.size} selected</div>
                ) : null}
              </div>

              {selectedCaseIds.size > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    to={buildCasesPrintPath(projectId, selectedCaseIdList)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Print selected
                  </Link>
                  <button
                    type="button"
                    disabled={bulkUpdateMutation.isPending}
                    onClick={() => {
                      setBulkOperationIds(null);
                      setBulkOperationLabel("selected");
                      setBulkUpdateOpen(true);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Update selected
                  </button>
                  <button
                    type="button"
                    disabled={relocationTargetSections.length === 0 || bulkMoveMutation.isPending}
                    onClick={() => setBulkRelocationOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy / Move
                  </button>
                  <button
                    type="button"
                    disabled={bulkArchiveMutation.isPending}
                    onClick={() => setBulkArchiveOpen(true)}
                    className="rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkArchiveMode === "archive" ? "Mark as deleted" : "Undelete selected"}
                  </button>
                  {bulkArchiveMode === "restore" ? (
                    <button
                      type="button"
                      disabled={bulkDeleteMutation.isPending}
                      onClick={() => setBulkDeleteOpen(true)}
                      className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete permanently
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3">
                <BulkCaseResultBanner feedback={bulkFeedback} onDismiss={() => setBulkFeedback(null)} />
              </div>
            </div>
          ) : null}

          {cases.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title={
                  activeFilterCount > 0
                    ? "No cases match the current filters"
                    : caseFilters.state === "archived"
                      ? "No archived test cases in this section subtree"
                      : "No test cases in this section subtree"
                }
                description={
                  activeFilterCount > 0
                    ? "Try clearing filters, switching sections, or saving a different view."
                    : caseFilters.state === "archived"
                      ? "Archive cases from the active list or switch sections."
                      : "Add a case or pick another section."
                }
                action={
                  activeFilterCount > 0 ? (
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
                      onClick={clearFiltersAndSearch}
                    >
                      Clear filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm text-white"
                      onClick={() => {
                        setCreateFormError(null);
                        setCreateFormVersion((current) => current + 1);
                        setShowAdd(true);
                      }}
                    >
                      Add case
                    </button>
                  )
                }
              />
            </div>
          ) : showGroupHeaders ? (
            <div id="groupContainer">
              {repositoryGroups.map((group) => {
                const depth = group.depth ?? 0;
                const isSectionGroup = group.sectionId != null && caseGroupBy === "section_id";
                return (
                  <div key={group.key}>
                    {group.label ? (
                      <div
                        className="border-b border-t border-slate-300 bg-[#e5e5e5] px-3 py-1.5 text-xs font-semibold text-slate-800"
                        {...(isSectionGroup && group.sectionId != null
                          ? { "data-section-group-id": group.sectionId }
                          : {})}
                      >
                        <div
                          className="flex items-center justify-between gap-3"
                          style={isSectionGroup ? { paddingLeft: `${Math.min(depth, 5) * 14}px` } : undefined}
                        >
                          {isSectionGroup && group.sectionId != null ? (
                            <button
                              type="button"
                              className="text-left text-blue-800 hover:underline"
                              onClick={() => {
                                setTreeFocusSection(group.sectionId!);
                                setShowAdd(false);
                              }}
                            >
                              {group.label}
                            </button>
                          ) : (
                            <span>{group.label}</span>
                          )}
                          <span className="font-normal text-slate-600">
                            {group.cases.length} case{group.cases.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    ) : null}
                    {group.cases.map((item) => renderCaseRow(item))}
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
