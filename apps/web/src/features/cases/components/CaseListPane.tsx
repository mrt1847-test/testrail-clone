import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState, type ComponentProps } from "react";

import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchCaseTemplates, fetchCustomFields } from "../../projects/api/settingsApi";
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
  deleteCase,
  deleteCaseStep,
  fetchCaseVersions,
  positionCases,
  restoreCaseVersion,
  updateCase,
  updateCaseStep
} from "../api/catalogApi";
import { useCaseDetail, caseDetailKeys } from "../hooks/useCaseDetail";
import type { CaseListDnD, PendingMoveCopy } from "../hooks/useCaseListDnD";
import { useCaseSavedViews } from "../hooks/useCaseSavedViews";
import { useCases, caseKeys } from "../hooks/useCases";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { sectionKeys } from "../hooks/useSections";
import type { SectionNode } from "../types";
import { CaseAuthoringForm } from "./CaseAuthoringForm";
import { CaseListToolbar } from "./CaseListToolbar";
import { CaseRow } from "./CaseRow";
import { ExpandableCaseDetail } from "./ExpandableCaseDetail";
import { MoveCopyChooserDialog } from "./MoveCopyChooserDialog";

type CaseListPaneProps = {
  projectId: string;
  sections: SectionNode[];
  dnd?: CaseListDnD;
  pendingMoveCopy?: PendingMoveCopy | null;
  onPendingMoveCopyChange?: (pending: PendingMoveCopy | null) => void;
};

function extractApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(error.message) as
      | { message?: string; error?: { message?: string } }
      | undefined;
    return parsed?.error?.message ?? parsed?.message ?? error.message;
  } catch {
    return error.message || fallback;
  }
}

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
  const { user } = useAuth();
  const {
    selectedSectionId,
    expandedCaseId,
    mode,
    caseFilters,
    caseColumns,
    setExpandedCase,
    setCaseFilters,
    setCaseColumns,
    clearCaseFilters,
    applySavedView
  } = useExpandedCase();

  const { data: cases = [], isLoading, isError, refetch } = useCases(projectId, selectedSectionId, caseFilters);
  const { data: customFields = [] } = useQuery({
    queryKey: ["case-custom-fields", projectId],
    queryFn: () => fetchCustomFields(projectId, "case"),
    enabled: Boolean(projectId)
  });
  const { data: caseTemplates = [] } = useQuery({
    queryKey: ["case-templates", projectId],
    queryFn: () => fetchCaseTemplates(projectId),
    enabled: Boolean(projectId)
  });
  const { data: caseDetailRemote } = useCaseDetail(expandedCaseId);
  const caseVersionsQuery = useQuery({
    queryKey: ["case-versions", expandedCaseId ?? -1],
    queryFn: () => fetchCaseVersions(expandedCaseId!),
    enabled: expandedCaseId != null
  });

  const [showAdd, setShowAdd] = useState(false);
  const [createFormVersion, setCreateFormVersion] = useState(0);
  const [createDraftSteps, setCreateDraftSteps] = useState<CaseCreateDraftStep[]>(initialCreateDraftSteps);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(caseFilters.q);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<number>>(new Set());
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkUpdatePriority, setBulkUpdatePriority] = useState<BulkPriorityValue>("");
  const [bulkUpdateCaseType, setBulkUpdateCaseType] = useState<BulkCaseTypeValue>("");
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveTargetId, setBulkMoveTargetId] = useState<number | null>(null);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkActionMessage, setBulkActionMessage] = useState<string | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");

  const deferredSearch = useDeferredValue(searchDraft);
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
    currentView
  );

  const visibleCaseIds = useMemo(() => cases.map((item) => item.id), [cases]);
  const selectedVisibleCaseIds = useMemo(
    () => visibleCaseIds.filter((caseId) => selectedCaseIds.has(caseId)),
    [selectedCaseIds, visibleCaseIds]
  );
  const allVisibleSelected = visibleCaseIds.length > 0 && selectedVisibleCaseIds.length === visibleCaseIds.length;
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
  const activeEditorCase = useMemo(
    () =>
      expandedCaseId != null
        ? (caseDetailRemote ?? cases.find((item) => item.id === expandedCaseId) ?? null)
        : null,
    [caseDetailRemote, cases, expandedCaseId]
  );

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
    if (expandedCaseId == null) return;
    setShowAdd(false);
  }, [expandedCaseId]);

  useEffect(() => {
    setEditFormError(null);
  }, [expandedCaseId, mode]);

  useEffect(() => {
    const normalized = deferredSearch.trim();
    if (normalized !== caseFilters.q) {
      setCaseFilters({ q: normalized });
    }
  }, [caseFilters.q, deferredSearch, setCaseFilters]);

  useEffect(() => {
    setSelectedCaseIds((current) => {
      const visible = new Set(visibleCaseIds);
      const next = new Set(Array.from(current).filter((caseId) => visible.has(caseId)));
      return next.size === current.size ? current : next;
    });
  }, [visibleCaseIds]);

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

  const invalidateAfterCaseEdit = (caseId: number) => {
    void qc.invalidateQueries({ queryKey: caseKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: caseDetailKeys.detail(caseId) });
    void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
    void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: ["case-versions", caseId] });
  };

  const createCaseMutation = useMutation({
    mutationFn: async (input: {
      title: string;
      preconditions: string;
      customValues: Record<string, string | number | boolean | null>;
      draftSteps: Array<{ description: string; expected: string }>;
    }) => {
      const created = await createCase(selectedSectionId!, {
        title: input.title,
        preconditions: input.preconditions,
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
      setExpandedCase(created.id);
      if (stepsWarning) {
        setBulkActionMessage(
          `Case was created, but saving one or more steps failed (${stepsWarning}). Open the case and add steps from edit mode.`
        );
      }
    },
    onError: (error) => {
      setCreateFormError(extractApiErrorMessage(error, "Could not create case."));
    }
  });

  const updateCaseMutation = useMutation({
    mutationFn: (input: {
      caseId: number;
      title: string;
      preconditions: string;
      customValues: Record<string, string | number | boolean | null>;
      expectedVersion?: number;
    }) =>
      updateCase(input.caseId, {
        title: input.title,
        preconditions: input.preconditions,
        customValues: input.customValues,
        expectedVersion: input.expectedVersion
      }),
    onSuccess: (_, vars) => {
      setEditFormError(null);
      invalidateAfterCaseEdit(vars.caseId);
    },
    onError: (error) => {
      setEditFormError(extractApiErrorMessage(error, "Could not save case changes."));
    }
  });

  const deleteCaseMutation = useMutation({
    mutationFn: (caseId: number) => deleteCase(caseId),
    onSuccess: () => {
      invalidateCases();
      setExpandedCase(null);
    }
  });

  const restoreVersionMutation = useMutation({
    mutationFn: (input: { caseId: number; versionId: number; expectedVersion?: number }) =>
      restoreCaseVersion(input.caseId, input.versionId, input.expectedVersion),
    onSuccess: (_, vars) => {
      invalidateAfterCaseEdit(vars.caseId);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (caseIds: number[]) => bulkDeleteCases(projectId, caseIds),
    onSuccess: (result) => {
      invalidateCases();
      setExpandedCase(null);
      const deletedIds = new Set(result.items.filter((item) => item.success).map((item) => Number(item.caseId)));
      setSelectedCaseIds((current) => new Set(Array.from(current).filter((caseId) => !deletedIds.has(caseId))));
      setBulkActionMessage(
        result.failed > 0
          ? `Deleted ${result.deleted}; ${result.failed} could not be deleted.`
          : `Deleted ${result.deleted} selected case${result.deleted === 1 ? "" : "s"}.`
      );
      setBulkDeleteOpen(false);
    }
  });

  const bulkMoveMutation = useMutation({
    mutationFn: (input: { caseIds: number[]; targetSectionId: number }) =>
      bulkMoveCases(projectId, input.caseIds, input.targetSectionId),
    onSuccess: (result) => {
      invalidateCases();
      setExpandedCase(null);
      const movedIds = new Set(result.items.filter((item) => item.success).map((item) => Number(item.caseId)));
      setSelectedCaseIds((current) => new Set(Array.from(current).filter((caseId) => !movedIds.has(caseId))));
      setBulkActionMessage(
        result.failed > 0
          ? `Moved ${result.moved}; ${result.failed} could not be moved.`
          : `Moved ${result.moved} selected case${result.moved === 1 ? "" : "s"}.`
      );
      setBulkMoveOpen(false);
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (input: { caseIds: number[]; patch: { priority?: string; caseType?: string } }) =>
      bulkUpdateCases(projectId, input.caseIds, input.patch),
    onSuccess: (result) => {
      invalidateCases();
      setExpandedCase(null);
      setBulkActionMessage(
        result.failed > 0
          ? `Updated ${result.updated}; ${result.failed} could not be updated.`
          : `Updated ${result.updated} selected case${result.updated === 1 ? "" : "s"}.`
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
      setExpandedCase(null);
      const changedIds = new Set(result.items.filter((item) => item.success).map((item) => Number(item.caseId)));
      setSelectedCaseIds((current) => new Set(Array.from(current).filter((caseId) => !changedIds.has(caseId))));
      setBulkActionMessage(
        result.failed > 0
          ? `${result.archived ? "Archived" : "Restored"} ${result.changed}; ${result.failed} could not be changed.`
          : `${result.archived ? "Archived" : "Restored"} ${result.changed} selected case${result.changed === 1 ? "" : "s"}.`
      );
      setBulkArchiveOpen(false);
    }
  });

  const bulkCopyMutation = useMutation({
    mutationFn: (input: { caseIds: number[]; targetSectionId: number }) =>
      bulkCopyCases(projectId, input.caseIds, input.targetSectionId),
    onSuccess: (result) => {
      invalidateCases();
      setBulkActionMessage(
        result.failed > 0
          ? `Copied ${result.copied}; ${result.failed} could not be copied.`
          : `Copied ${result.copied} case${result.copied === 1 ? "" : "s"} to the target section.`
      );
    },
    onError: (error) => {
      setBulkActionMessage(extractApiErrorMessage(error, "Could not copy the selected cases."));
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
      setBulkActionMessage(
        `Reordered ${variables.caseIds.length} case${variables.caseIds.length === 1 ? "" : "s"} within the section (${result.updated} positions updated).`
      );
    },
    onError: (error) => {
      setBulkActionMessage(extractApiErrorMessage(error, "Could not reorder cases."));
    }
  });

  const invalidateCaseDetail = (caseId: number) => {
    void qc.invalidateQueries({ queryKey: caseDetailKeys.detail(caseId) });
    void qc.invalidateQueries({ queryKey: ["case-versions", caseId] });
  };

  const createStepMutation = useMutation({
    mutationFn: (input: { caseId: number; content: string; expected: string }) =>
      createCaseStep(input.caseId, {
        content: input.content,
        expectedResult: input.expected.length ? input.expected : null
      }),
    onSuccess: (_, vars) => {
      invalidateCases();
      invalidateCaseDetail(vars.caseId);
    }
  });

  const updateStepMutation = useMutation({
    mutationFn: (input: {
      caseId: number;
      stepId: number;
      patch: { content?: string; expectedResult?: string | null; stepOrder?: number };
    }) => updateCaseStep(input.stepId, input.patch),
    onSuccess: (_, vars) => {
      invalidateCases();
      invalidateCaseDetail(vars.caseId);
    }
  });

  const deleteStepMutation = useMutation({
    mutationFn: (input: { caseId: number; stepId: number }) => deleteCaseStep(input.stepId),
    onSuccess: (_, vars) => {
      invalidateCases();
      invalidateCaseDetail(vars.caseId);
    }
  });

  const stepsBusy = createStepMutation.isPending || updateStepMutation.isPending || deleteStepMutation.isPending;

  const toggleCaseSelection = (caseId: number, checked: boolean) => {
    setBulkActionMessage(null);
    setSelectedCaseIds((current) => {
      const next = new Set(current);
      if (checked) next.add(caseId);
      else next.delete(caseId);
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    setBulkActionMessage(null);
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
    setBulkActionMessage(null);
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
    setBulkActionMessage(null);
    void positionCasesMutation.mutateAsync({
      sectionId: input.sectionId,
      caseIds: input.caseIds
    });
  };

  const handleCrossSectionDrop = (pending: PendingMoveCopy) => {
    onPendingMoveCopyChange?.(pending);
  };

  const handleMoveConfirm = () => {
    if (!pendingMoveCopy || dndAnyMutationPending) return;
    bulkMoveMutation.mutate(
      { caseIds: pendingMoveCopy.caseIds, targetSectionId: pendingMoveCopy.targetSectionId },
      {
        onSuccess: () => {
          onPendingMoveCopyChange?.(null);
        }
      }
    );
  };

  const handleCopyConfirm = () => {
    if (!pendingMoveCopy || dndAnyMutationPending) return;
    bulkCopyMutation.mutate(
      { caseIds: pendingMoveCopy.caseIds, targetSectionId: pendingMoveCopy.targetSectionId },
      {
        onSuccess: () => {
          onPendingMoveCopyChange?.(null);
        }
      }
    );
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
      applySavedView({ sectionId: view.sectionId, filters: view.filters, columns: view.columns });
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
      setBulkActionMessage(null);
      setCreateFormError(null);
      setExpandedCase(null);
      setShowAdd(true);
      setCreateFormVersion((value) => value + 1);
    }
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
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Case Repository</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {selectedSection?.name ?? "Selected section"}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {cases.length} visible case{cases.length === 1 ? "" : "s"} in the{" "}
                  {caseFilters.state === "archived" ? "archived" : "active"} repository.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                {showAdd
                  ? "Create panel open"
                  : activeEditorCase
                    ? `${mode === "edit" ? "Editing" : "Reviewing"} ${activeEditorCase.caseCode}`
                    : "Editor idle"}
              </div>
            </div>
          </div>

          <CaseListToolbar {...toolbarProps} />

          {cases.length > 0 ? (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  Select visible
                </label>
                <div className="text-sm text-slate-600">
                  {selectedVisibleCaseIds.length > 0
                    ? `${selectedVisibleCaseIds.length} selected`
                    : "Select one or more cases to show bulk actions"}
                </div>
              </div>

              {selectedVisibleCaseIds.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
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

              {bulkActionMessage ? <p className="mt-3 text-sm text-slate-600">{bulkActionMessage}</p> : null}
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
                        setExpandedCase(null);
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
                const isExpanded = expandedCaseId === item.id;
                const caseDetail = isExpanded ? caseDetailRemote ?? item : item;
                const isDraggingThis = dnd?.draggingCaseIds?.includes(item.id) ?? false;
                const dropIndicator =
                  dnd?.hoveredRow?.caseId === item.id ? dnd.hoveredRow.position : null;
                return (
                  <CaseRow
                    key={item.id}
                    item={item}
                    isExpanded={isExpanded}
                    mode={mode}
                    detail={caseDetail}
                    versions={isExpanded ? caseVersionsQuery.data ?? [] : []}
                    customFields={customFields}
                    caseTemplates={caseTemplates}
                    visibleColumns={caseColumns}
                    isSelected={selectedCaseIds.has(item.id)}
                    onSelectChange={(checked) => toggleCaseSelection(item.id, checked)}
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
                    onToggle={() => {
                      setShowAdd(false);
                      setExpandedCase(isExpanded ? null : item.id);
                    }}
                    onEdit={() => {
                      setShowAdd(false);
                      setExpandedCase(item.id, "edit");
                    }}
                    onCloseDetail={() => setExpandedCase(null)}
                    onSave={async (patch) => {
                      await updateCaseMutation.mutateAsync({
                        caseId: item.id,
                        ...patch,
                        expectedVersion: Number.isInteger(caseDetail.lockVersion)
                          ? caseDetail.lockVersion
                          : undefined
                      });
                      setExpandedCase(item.id, "view");
                    }}
                    onDelete={async () => {
                      await deleteCaseMutation.mutateAsync(item.id);
                    }}
                    onRestoreVersion={async (versionId) => {
                      await restoreVersionMutation.mutateAsync({
                        caseId: item.id,
                        versionId,
                        expectedVersion: Number.isInteger(caseDetail.lockVersion)
                          ? caseDetail.lockVersion
                          : undefined
                      });
                    }}
                    isSaving={updateCaseMutation.isPending}
                    submitError={editFormError}
                    isDeleting={deleteCaseMutation.isPending}
                    isRestoring={restoreVersionMutation.isPending}
                    onCreateStep={async (input) => {
                      await createStepMutation.mutateAsync({ caseId: item.id, ...input });
                    }}
                    onUpdateStep={async (stepId, patch) => {
                      await updateStepMutation.mutateAsync({ caseId: item.id, stepId, patch });
                    }}
                    onDeleteStep={async (stepId) => {
                      await deleteStepMutation.mutateAsync({ caseId: item.id, stepId });
                    }}
                    isStepsBusy={stepsBusy}
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

        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
          {showAdd ? (
            <>
              <div className="border-b border-slate-200 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Case Editor</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">New test case</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Creating in {selectedSection?.name ?? "the selected section"}.
                </p>
              </div>
              <div className="p-4">
                <CaseAuthoringForm
                  valueKey={`create:${selectedSectionId ?? "none"}:${createFormVersion}`}
                  initialTitle=""
                  initialPreconditions=""
                  initialCustomValues={{}}
                  customFields={customFields}
                  templates={caseTemplates}
                  submitLabel={createCaseMutation.isPending ? "Creating..." : "Create"}
                  isSubmitting={createCaseMutation.isPending}
                  submitError={createFormError}
                  stepsSection={
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
                  }
                  onSubmit={async (input) => {
                    setCreateFormError(null);
                    await createCaseMutation.mutateAsync({
                      title: input.title,
                      preconditions: input.preconditions,
                      customValues: input.customValues,
                      draftSteps: createDraftSteps.map(({ description, expected }) => ({ description, expected }))
                    });
                  }}
                  onCancel={() => {
                    setShowAdd(false);
                    setCreateFormError(null);
                    setCreateFormVersion((current) => current + 1);
                  }}
                />
              </div>
            </>
          ) : activeEditorCase ? (
            <>
              <div className="border-b border-slate-200 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Case Editor</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {activeEditorCase.caseCode} {activeEditorCase.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {mode === "edit" ? "Editing full case details." : "Reviewing case details and history."}
                </p>
              </div>
              <ExpandableCaseDetail
                data={activeEditorCase}
                versions={caseVersionsQuery.data ?? []}
                customFields={customFields}
                caseTemplates={caseTemplates}
                mode={mode}
                onEdit={() => setExpandedCase(activeEditorCase.id, "edit")}
                onClose={() => setExpandedCase(null)}
                onSave={async (patch) => {
                  await updateCaseMutation.mutateAsync({
                    caseId: activeEditorCase.id,
                    ...patch,
                    expectedVersion: Number.isInteger(activeEditorCase.lockVersion)
                      ? activeEditorCase.lockVersion
                      : undefined
                  });
                  setExpandedCase(activeEditorCase.id, "view");
                }}
                onDelete={async () => {
                  await deleteCaseMutation.mutateAsync(activeEditorCase.id);
                }}
                onRestoreVersion={async (versionId) => {
                  await restoreVersionMutation.mutateAsync({
                    caseId: activeEditorCase.id,
                    versionId,
                    expectedVersion: Number.isInteger(activeEditorCase.lockVersion)
                      ? activeEditorCase.lockVersion
                      : undefined
                  });
                }}
                isSaving={updateCaseMutation.isPending}
                submitError={editFormError}
                isDeleting={deleteCaseMutation.isPending}
                isRestoring={restoreVersionMutation.isPending}
                onCreateStep={async (input) => {
                  await createStepMutation.mutateAsync({ caseId: activeEditorCase.id, ...input });
                }}
                onUpdateStep={async (stepId, patch) => {
                  await updateStepMutation.mutateAsync({ caseId: activeEditorCase.id, stepId, patch });
                }}
                onDeleteStep={async (stepId) => {
                  await deleteStepMutation.mutateAsync({ caseId: activeEditorCase.id, stepId });
                }}
                isStepsBusy={stepsBusy}
              />
            </>
          ) : (
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Case Editor</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Focus panel</h3>
              <p className="mt-2 text-sm text-slate-600">
                Select a case from the repository to review or edit it here, or create a new case to keep authoring separate from the browsing surface.
              </p>
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={bulkUpdateOpen}
        title="Update selected test cases?"
        description={
          <div className="space-y-3">
            <p>
              Apply shared field changes to {selectedVisibleCaseIds.length} selected test case
              {selectedVisibleCaseIds.length === 1 ? "" : "s"}.
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
          bulkUpdateMutation.isPending || selectedVisibleCaseIds.length === 0 || !hasBulkUpdatePatch
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
            caseIds: selectedVisibleCaseIds,
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
              {selectedVisibleCaseIds.length} selected test case{selectedVisibleCaseIds.length === 1 ? "" : "s"} will
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
          bulkMoveMutation.isPending || selectedVisibleCaseIds.length === 0 || bulkMoveTargetId == null
        }
        onCancel={() => setBulkMoveOpen(false)}
        onConfirm={() => {
          if (bulkMoveTargetId != null) {
            void bulkMoveMutation.mutateAsync({
              caseIds: selectedVisibleCaseIds,
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
            {selectedVisibleCaseIds.length} selected test case{selectedVisibleCaseIds.length === 1 ? "" : "s"} will be{" "}
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
        confirmDisabled={bulkArchiveMutation.isPending || selectedVisibleCaseIds.length === 0}
        onCancel={() => setBulkArchiveOpen(false)}
        onConfirm={() =>
          void bulkArchiveMutation.mutateAsync({
            caseIds: selectedVisibleCaseIds,
            archived: bulkArchiveMode === "archive"
          })
        }
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Delete selected test cases?"
        description={
          <span>
            {selectedVisibleCaseIds.length} selected test case{selectedVisibleCaseIds.length === 1 ? "" : "s"} will be deleted from this project.
          </span>
        }
        variant="danger"
        confirmLabel={bulkDeleteMutation.isPending ? "Deleting..." : "Delete selected"}
        confirmDisabled={bulkDeleteMutation.isPending || selectedVisibleCaseIds.length === 0}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void bulkDeleteMutation.mutateAsync(selectedVisibleCaseIds)}
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
                position appends to the end of the target section.
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
