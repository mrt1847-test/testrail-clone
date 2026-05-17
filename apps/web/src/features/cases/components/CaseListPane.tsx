import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
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
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import {
  bulkArchiveCases,
  bulkCopyCases,
  bulkDeleteCases,
  bulkMoveCases,
  bulkUpdateCases,
  createCase,
  createCaseStep,
  fetchAllCasesForSection,
  positionCases
} from "../api/catalogApi";
import { buildCaseDetailPath } from "../caseRoute";
import { extractApiErrorMessage } from "../caseErrors";
import type { BulkCaseFeedback } from "../utils/bulkCaseFeedback";
import { buildBulkCaseFeedback } from "../utils/bulkCaseFeedback";
import { BulkCaseResultBanner } from "./BulkCaseResultBanner";
import type { CaseListDnD, PendingMoveCopy } from "../hooks/useCaseListDnD";
import { useCaseSavedViews } from "../hooks/useCaseSavedViews";
import { useCases, caseKeys } from "../hooks/useCases";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { sectionKeys } from "../hooks/useSections";
import type { SectionNode } from "../types";
import { CaseAuthoringForm } from "./CaseAuthoringForm";
import { CaseListToolbar } from "./CaseListToolbar";
import { CaseRow } from "./CaseRow";
import { MoveCopyChooserDialog } from "./MoveCopyChooserDialog";
import {
  buildSectionOnlyFilters,
  hasActiveCaseListFilters,
  mergeNumericIds
} from "../utils/caseListSelection";

type CaseListPaneProps = {
  projectId: string;
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
    caseFilters,
    caseColumns,
    setCaseFilters,
    setCaseColumns,
    clearCaseFilters,
    applySavedView,
    togglePanelCase,
    setPanelCase
  } = useExpandedCase();

  const directCaseFilters = useMemo(() => ({ ...caseFilters, sectionScope: "direct" as const }), [caseFilters]);
  const { data: cases = [], isLoading, isError, refetch } = useCases(projectId, selectedSectionId, directCaseFilters);
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
  const [bulkUpdatePriority, setBulkUpdatePriority] = useState<BulkPriorityValue>("");
  const [bulkUpdateCaseType, setBulkUpdateCaseType] = useState<BulkCaseTypeValue>("");
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveTargetId, setBulkMoveTargetId] = useState<number | null>(null);
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

  const visibleCaseIds = useMemo(() => cases.map((item) => item.id), [cases]);
  const selectedVisibleCaseIds = useMemo(
    () => visibleCaseIds.filter((caseId) => selectedCaseIds.has(caseId)),
    [selectedCaseIds, visibleCaseIds]
  );
  const selectedCaseIdList = useMemo(() => Array.from(selectedCaseIds), [selectedCaseIds]);
  const allVisibleSelected = visibleCaseIds.length > 0 && selectedVisibleCaseIds.length === visibleCaseIds.length;
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
  const moveTargets = useMemo(
    () => sections.filter((section) => section.id !== selectedSectionId),
    [sections, selectedSectionId]
  );
  const hasBulkUpdatePatch = bulkUpdatePriority !== "" || bulkUpdateCaseType !== "";
  const bulkArchiveMode = caseFilters.state === "archived" ? "restore" : "archive";
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId]
  );
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
  }, [selectedSectionId]);

  useEffect(() => {
    setBulkMoveTargetId((current) => {
      if (current != null && moveTargets.some((section) => section.id === current)) return current;
      return moveTargets[0]?.id ?? null;
    });
  }, [moveTargets]);

  const invalidateCases = () => {
    void qc.invalidateQueries({ queryKey: caseKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: sectionKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
    void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
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
      const created = await createCase(selectedSectionId!, {
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
      setBulkMoveOpen(false);
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
      setBulkUpdatePriority("");
      setBulkUpdateCaseType("");
    }
  });

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
      const rows = await fetchAllCasesForSection(projectId, selectedSectionId, directCaseFilters);
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
    columnsValue: caseColumns,
    onColumnsChange: setCaseColumns,
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
  } satisfies ComponentProps<typeof CaseListToolbar>;

  const clearFiltersAndSearch = () => {
    setSearchDraft("");
    clearCaseFilters();
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CaseListToolbar {...toolbarProps} />
        <div className="p-6">
          <LoadingState message="Loading the case repository..." />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <CaseListToolbar {...toolbarProps} />
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
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedSection?.name ?? "Selected section"}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {cases.length} visible case{cases.length === 1 ? "" : "s"} in the{" "}
                  {caseFilters.state === "archived" ? "archived" : "active"} repository.
                </p>
              </div>
            </div>
          </div>

          <CaseListToolbar {...toolbarProps} />

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
                    onClick={() => setBulkUpdateOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Update selected
                  </button>
                  <button
                    type="button"
                    disabled={moveTargets.length === 0 || bulkMoveMutation.isPending}
                    onClick={() => setBulkMoveOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Move selected
                  </button>
                  <button
                    type="button"
                    disabled={bulkArchiveMutation.isPending}
                    onClick={() => setBulkArchiveOpen(true)}
                    className="rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkArchiveMode === "archive" ? "Archive selected" : "Restore selected"}
                  </button>
                  <button
                    type="button"
                    disabled={bulkDeleteMutation.isPending}
                    onClick={() => setBulkDeleteOpen(true)}
                    className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete selected
                  </button>
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
                      ? "No archived test cases in this section"
                      : "No test cases in this section"
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
          ) : (
            <div>
              {cases.map((item) => {
                const isDraggingThis = dnd?.draggingCaseIds?.includes(item.id) ?? false;
                const dropIndicator =
                  dnd?.hoveredRow?.caseId === item.id ? dnd.hoveredRow.position : null;
                return (
                  <CaseRow
                    key={item.id}
                    item={item}
                    isExpanded={false}
                    isPanelOpen={panelCaseId === item.id}
                    mode="view"
                    detail={item}
                    versions={[]}
                    customFields={customFields}
                    caseTemplates={caseTemplates}
                    visibleColumns={caseColumns}
                    isSelected={selectedCaseIds.has(item.id)}
                    onSelectChange={(checked) => toggleCaseSelection(item.id, checked)}
                    onSelectClick={(event) => handleCaseSelectClick(event, item.id)}
                    draggable={Boolean(dnd) && selectedSectionId != null}
                    isDraggingThis={isDraggingThis}
                    dropIndicator={dropIndicator}
                    onRowDragStart={(event) => {
                      if (!dnd || selectedSectionId == null) return;
                      dnd.startCaseDrag(event, {
                        caseId: item.id,
                        sectionId: selectedSectionId,
                        selectedCaseIds
                      });
                    }}
                    onRowDragEnd={() => dnd?.endCaseDrag()}
                    onRowDragOver={(event) => dnd?.handleRowDragOver({ event, caseId: item.id })}
                    onRowDragLeave={() => dnd?.handleRowDragLeave(item.id)}
                    onRowDrop={(event) => {
                      if (!dnd || selectedSectionId == null) return;
                      dnd.handleRowDrop({
                        event,
                        targetCaseId: item.id,
                        targetSectionId: selectedSectionId,
                        visibleCaseIds,
                        onSamePositionDrop: handleSamePositionDrop,
                        onCrossSectionDrop: handleCrossSectionDrop
                      });
                    }}
                    onOpenCase={() => {
                      setShowAdd(false);
                      openCasePage(item.id);
                    }}
                    onTogglePanel={() => {
                      setShowAdd(false);
                      togglePanelCase(item.id);
                    }}
                    onEdit={() => {
                      setShowAdd(false);
                      setPanelCase(item.id, "edit");
                    }}
                    onCloseDetail={() => {}}
                    onSave={async () => {}}
                    onDelete={async () => {}}
                    renderDetailInline={false}
                  />
                );
              })}
              {dnd?.isDragging && selectedSectionId != null ? (
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
                      currentSectionId: selectedSectionId,
                      onSameSectionAppend: handleSameSectionAppend,
                      onCrossSectionDrop: handleCrossSectionDrop
                    })
                  }
                >
                  Drop here to append {dnd.draggingCount} case{dnd.draggingCount === 1 ? "" : "s"}
                  {dnd.sourceSectionId === selectedSectionId ? " to the end of this section" : " into this section"}
                </div>
              ) : null}
            </div>
          )}
        </section>

      </div>

      <ConfirmDialog
        open={bulkUpdateOpen}
        title="Update selected test cases?"
        description={
          <div className="space-y-3">
            <p>
              Apply shared field changes to {selectedCaseIdList.length} selected test case
              {selectedCaseIdList.length === 1 ? "" : "s"}.
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
        confirmLabel={bulkUpdateMutation.isPending ? "Updating..." : "Update selected"}
        confirmDisabled={
          bulkUpdateMutation.isPending || selectedCaseIdList.length === 0 || !hasBulkUpdatePatch
        }
        onCancel={() => {
          setBulkUpdateOpen(false);
          setBulkUpdatePriority("");
          setBulkUpdateCaseType("");
        }}
        onConfirm={() => {
          const patch: { priority?: string; caseType?: string } = {};
          if (bulkUpdatePriority) patch.priority = bulkUpdatePriority;
          if (bulkUpdateCaseType) patch.caseType = bulkUpdateCaseType;
          void bulkUpdateMutation.mutateAsync({
            caseIds: selectedCaseIdList,
            patch
          });
        }}
      />

      <ConfirmDialog
        open={bulkMoveOpen}
        title="Move selected test cases?"
        description={
          <div className="space-y-3">
            <p>
              {selectedCaseIdList.length} selected test case{selectedCaseIdList.length === 1 ? "" : "s"} will
              be moved to another section.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Target section
              </span>
              <select
                value={bulkMoveTargetId ?? ""}
                onChange={(e) => setBulkMoveTargetId(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {moveTargets.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        confirmLabel={bulkMoveMutation.isPending ? "Moving..." : "Move selected"}
        confirmDisabled={
          bulkMoveMutation.isPending || selectedCaseIdList.length === 0 || bulkMoveTargetId == null
        }
        onCancel={() => setBulkMoveOpen(false)}
        onConfirm={() => {
          if (bulkMoveTargetId != null) {
            void bulkMoveMutation.mutateAsync({
              caseIds: selectedCaseIdList,
              targetSectionId: bulkMoveTargetId
            });
          }
        }}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        title={bulkArchiveMode === "archive" ? "Archive selected test cases?" : "Restore selected test cases?"}
        description={
          <span>
            {selectedCaseIdList.length} selected test case{selectedCaseIdList.length === 1 ? "" : "s"} will be{" "}
            {bulkArchiveMode === "archive"
              ? "hidden from the active repository list and run composition"
              : "returned to the active repository list"}
            .
          </span>
        }
        confirmLabel={
          bulkArchiveMutation.isPending
            ? bulkArchiveMode === "archive"
              ? "Archiving..."
              : "Restoring..."
            : bulkArchiveMode === "archive"
              ? "Archive selected"
              : "Restore selected"
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
        title="Delete selected test cases?"
        description={
          <span>
            {selectedCaseIdList.length} selected test case{selectedCaseIdList.length === 1 ? "" : "s"} will be deleted from this project.
          </span>
        }
        variant="danger"
        confirmLabel={bulkDeleteMutation.isPending ? "Deleting..." : "Delete selected"}
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
