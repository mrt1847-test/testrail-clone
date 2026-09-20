import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { OverflowMenu, type OverflowMenuHandle } from "../../../shared/ui/OverflowMenu";
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import {
  copySectionSubtree,
  createCase,
  createSection,
  deleteSection,
  fetchSuiteSummary,
  reorderSections,
  updateSection
} from "../api/catalogApi";
import { updateSuite } from "../../projects/api/suitesApi";
import type { CaseRepositoryTreeSide } from "../caseRepositoryLayout";
import { SuiteDescriptionDialog } from "./SuiteDescriptionDialog";
import { extractApiErrorMessage } from "../caseErrors";
import { caseKeys } from "../hooks/useCases";
import { sectionKeys } from "../hooks/useSections";
import type { SectionNode } from "../types";
import { readCollapsedSectionIds, writeCollapsedSectionIds } from "../sectionTreeCollapse";
import { normalizeQuickAddCaseTitle } from "../utils/sectionTreeQuickAdd";
import { MoveCopyChooserDialog } from "./MoveCopyChooserDialog";
import { SectionTreeQuickAddCase } from "./SectionTreeQuickAddCase";
import { sectionMoveDestinations, sectionPathLabel } from "../utils/sectionTreeModel";
import { resolveSectionTreeKey, sectionCreateFieldId } from "../utils/sectionTreeKeyboard";

const SECTION_DRAG_MIME = "application/x-testrail-section-id";
type SectionDropIntent = "before" | "after" | "inside";
type PendingSectionMoveCopy = {
  sourceSectionId: number;
  targetParentSectionId: number | null;
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path
        d={expanded ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 18 16" className="h-4 w-4" aria-hidden>
      <path
        d={
          open
            ? "M1.5 4.5h5l1.4 1.5h8.6l-1.5 7.5H2.5L1.5 4.5z"
            : "M1.5 3h5l1.5 1.5h8.5v9H1.5V3z"
        }
        fill={open ? "#bfdbfe" : "#e2e8f0"}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type SectionTreePaneProps = {
  suiteId: string;
  sections: SectionNode[];
  selectedSectionId: number | null;
  onSelectSection: (id: number) => void;
  onClearExpand: () => void;
  onQuickAddCaseCreated?: (input: { sectionId: number; caseId: number }) => void;
  onAddTestCase?: () => void;
  editDescriptionRequest?: number;
  treeSide?: CaseRepositoryTreeSide;
  onToggleTreeSide?: () => void;
  dnd?: {
    isDragging: boolean;
    draggingCount: number;
    sourceSectionId: number | null;
    hoveredSectionId: number | null;
    onDragOver: (event: DragEvent<HTMLElement>, sectionId: number) => void;
    onDragLeave: (sectionId: number) => void;
    onDrop: (event: DragEvent<HTMLElement>, sectionId: number) => void;
  };
};

function readSectionDragId(event: DragEvent): number | null {
  const raw = event.dataTransfer.getData(SECTION_DRAG_MIME);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

function hasSectionDrag(event: DragEvent, fallback: number | null) {
  return fallback != null || Array.from(event.dataTransfer.types).includes(SECTION_DRAG_MIME);
}

function computeSectionDropIntent(event: DragEvent, host: HTMLElement): SectionDropIntent {
  const rect = host.getBoundingClientRect();
  const offset = event.clientY - rect.top;
  if (offset < rect.height * 0.28) return "before";
  if (offset > rect.height * 0.72) return "after";
  return "inside";
}

export function SectionTreePane({
  suiteId,
  sections,
  selectedSectionId,
  onSelectSection,
  onClearExpand,
  onQuickAddCaseCreated,
  onAddTestCase,
  editDescriptionRequest = 0,
  treeSide = "right",
  onToggleTreeSide,
  dnd
}: SectionTreePaneProps) {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const suiteSummaryQuery = useQuery({
    queryKey: ["suite-summary", projectId, suiteId],
    queryFn: () => fetchSuiteSummary(projectId, suiteId),
    enabled: Boolean(projectId && suiteId)
  });
  const [newName, setNewName] = useState("");
  const [sectionCreateParentId, setSectionCreateParentId] = useState<number | null | undefined>(undefined);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [suiteMenuOpen, setSuiteMenuOpen] = useState(false);
  const suiteMenuButtonRef = useRef<HTMLButtonElement>(null);
  const treeItemRefs = useRef(new Map<number, HTMLLIElement>());
  const actionMenuRefs = useRef(new Map<number, OverflowMenuHandle>());
  const [relocateSourceId, setRelocateSourceId] = useState<number | null>(null);
  const [relocateTargetParentId, setRelocateTargetParentId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SectionNode | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sectionDragSourceId, setSectionDragSourceId] = useState<number | null>(null);
  const [sectionDropTarget, setSectionDropTarget] = useState<{ id: number; intent: SectionDropIntent } | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const [pendingSectionMoveCopy, setPendingSectionMoveCopy] = useState<PendingSectionMoveCopy | null>(null);
  const [sectionPendingAction, setSectionPendingAction] = useState<"move" | "copy" | null>(null);
  const [sectionActionMessage, setSectionActionMessage] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<number>>(() =>
    readCollapsedSectionIds(projectId, suiteId)
  );
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddSectionId, setQuickAddSectionId] = useState<number | null>(null);
  const [quickAddFeedback, setQuickAddFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [quickAddFocusRequest, setQuickAddFocusRequest] = useState(0);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const updateSuiteDescriptionMutation = useMutation({
    mutationFn: (description: string) =>
      updateSuite(suiteId, { description: description.trim().length > 0 ? description.trim() : null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["suite-summary", projectId, suiteId] });
      setDescriptionDialogOpen(false);
      setDescriptionError(null);
    },
    onError: (error) => {
      setDescriptionError(extractApiErrorMessage(error, "Could not update the suite description."));
    }
  });

  useEffect(() => {
    if (editDescriptionRequest <= 0) return;
    setDescriptionError(null);
    setDescriptionDialogOpen(true);
  }, [editDescriptionRequest]);

  const sectionByParent = sections.reduce<Map<number | null, SectionNode[]>>((acc, section) => {
    const parent = section.parentSectionId ?? null;
    const list = acc.get(parent);
    if (list) list.push(section);
    else acc.set(parent, [section]);
    return acc;
  }, new Map());
  for (const list of sectionByParent.values()) {
    list.sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);
  }
  const sectionById = new Map(sections.map((section) => [section.id, section]));

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: sectionKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: caseKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: ["suite-summary", projectId] });
    void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
    void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
  };

  const createMutation = useMutation({
    mutationFn: ({ name, parentSectionId }: { name: string; parentSectionId?: number | null }) =>
      createSection(suiteId, name, parentSectionId),
    onSuccess: () => {
      invalidate();
      setNewName("");
      setSectionCreateParentId(undefined);
    }
  });

  const quickAddCaseMutation = useMutation({
    mutationFn: ({ sectionId, title }: { sectionId: number; title: string }) => createCase(sectionId, { title }),
    onSuccess: (created, variables) => {
      invalidate();
      setQuickAddTitle("");
      setQuickAddFeedback({
        tone: "success",
        message: `${created.caseCode} saved. Ready for another title.`
      });
      onSelectSection(variables.sectionId);
      onQuickAddCaseCreated?.({ sectionId: variables.sectionId, caseId: created.id });
    },
    onError: (error) => {
      setQuickAddFeedback({
        tone: "error",
        message: `${extractApiErrorMessage(error, "Could not create the case.")} Your title is still here.`
      });
    }
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateSection(id, { name }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setEditName("");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSection(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      setDeleteError(null);
      onClearExpand();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("SECTION_NOT_EMPTY")) {
        setDeleteError("This section still contains child sections or test cases. Move or delete those first.");
        return;
      }
      setDeleteError("Could not delete the section. Please try again.");
    }
  });

  const reorderMutation = useMutation({
    mutationFn: async (input: {
      sourceSectionId: number;
      targetSectionId: number;
      intent: SectionDropIntent;
    }) => {
      const source = sectionById.get(input.sourceSectionId);
      const target = sectionById.get(input.targetSectionId);
      if (!source || !target) throw new Error("Could not resolve section drop target.");
      if (source.suiteId !== target.suiteId) {
        throw new Error("Sections can only be moved within the same suite.");
      }
      const descendantIds = collectDescendantIds(input.sourceSectionId);
      if (input.targetSectionId === input.sourceSectionId || descendantIds.has(input.targetSectionId)) {
        throw new Error("A section cannot be moved into itself or one of its child sections.");
      }

      if (input.intent === "inside") return { action: "pending" as const };

      const targetParentSectionId = target.parentSectionId ?? null;
      if (targetParentSectionId != null && descendantIds.has(targetParentSectionId)) {
        throw new Error("A section cannot be moved next to one of its child sections.");
      }
      if ((source.parentSectionId ?? null) !== targetParentSectionId) {
        await updateSection(input.sourceSectionId, { parentSectionId: targetParentSectionId });
      }

      const siblingIds = (sectionByParent.get(targetParentSectionId) ?? [])
        .map((section) => section.id)
        .filter((id) => id !== input.sourceSectionId);
      const targetIndex = siblingIds.indexOf(input.targetSectionId);
      if (targetIndex < 0) throw new Error("Could not resolve target sibling order.");
      const insertIndex = input.intent === "before" ? targetIndex : targetIndex + 1;
      const orderedSectionIds = [
        ...siblingIds.slice(0, insertIndex),
        input.sourceSectionId,
        ...siblingIds.slice(insertIndex)
      ];
      await reorderSections(String(target.suiteId), { parentSectionId: targetParentSectionId, orderedSectionIds });
      return { action: "reordered" as const };
    },
    onSuccess: (result) => {
      invalidate();
      if (result.action === "reordered") setSectionActionMessage("Section order updated.");
    },
    onError: (error) => {
      setSectionActionMessage(error instanceof Error ? error.message : "Could not move the section.");
    }
  });

  const moveSectionMutation = useMutation({
    mutationFn: (input: { sourceSectionId: number; targetParentSectionId: number | null }) =>
      updateSection(input.sourceSectionId, { parentSectionId: input.targetParentSectionId }),
    onSuccess: (result) => {
      invalidate();
      setSectionActionMessage(
        result.parentSectionId == null ? "Section moved to the root level." : "Section moved into the target section."
      );
      setPendingSectionMoveCopy(null);
      setSectionPendingAction(null);
      setRelocateSourceId(null);
    },
    onError: (error) => {
      setSectionActionMessage(error instanceof Error ? error.message : "Could not move the section.");
      setSectionPendingAction(null);
    }
  });

  const copyMutation = useMutation({
    mutationFn: (input: { sectionId: number; targetParentSectionId: number | null }) =>
      copySectionSubtree(input.sectionId, { targetParentSectionId: input.targetParentSectionId }),
    onSuccess: (result) => {
      invalidate();
      setSectionActionMessage(
        `Copied ${result.sectionIdMap.length} section${result.sectionIdMap.length === 1 ? "" : "s"} and ${result.caseIdMap.length} case${result.caseIdMap.length === 1 ? "" : "s"}.`
      );
      setPendingSectionMoveCopy(null);
      setSectionPendingAction(null);
      setRelocateSourceId(null);
    },
    onError: (error) => {
      setSectionActionMessage(error instanceof Error ? error.message : "Could not copy the section.");
      setSectionPendingAction(null);
    }
  });

  const collectDescendantIds = (sectionId: number) => {
    const out = new Set<number>();
    const stack = [...(sectionByParent.get(sectionId) ?? []).map((section) => section.id)];
    while (stack.length > 0) {
      const next = stack.pop()!;
      out.add(next);
      stack.push(...(sectionByParent.get(next) ?? []).map((section) => section.id));
    }
    return out;
  };

  const collectAncestorIds = (sectionId: number) => {
    const out = new Set<number>();
    let current = sectionById.get(sectionId);
    while (current?.parentSectionId != null) {
      out.add(current.parentSectionId);
      current = sectionById.get(current.parentSectionId);
    }
    return out;
  };

  useEffect(() => {
    setCollapsedSectionIds(readCollapsedSectionIds(projectId, suiteId));
  }, [projectId, suiteId]);

  useEffect(() => {
    if (selectedSectionId == null) return;
    const validSectionIds = new Set(sections.map((section) => section.id));
    const ancestors = collectAncestorIds(selectedSectionId);
    setCollapsedSectionIds((current) => {
      const next = new Set(Array.from(current).filter((id) => validSectionIds.has(id) && !ancestors.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [sections, selectedSectionId]);

  useEffect(() => {
    writeCollapsedSectionIds(projectId, suiteId, collapsedSectionIds);
  }, [projectId, suiteId, collapsedSectionIds]);

  useEffect(() => {
    setQuickAddTitle("");
    setQuickAddFeedback(null);
  }, [selectedSectionId]);

  useEffect(() => {
    if (!suiteMenuOpen) return;
    const closeMenus = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-section-tree-menu]")) return;
      setSuiteMenuOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSuiteMenuOpen(false);
      window.requestAnimationFrame(() => suiteMenuButtonRef.current?.focus());
    };
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [suiteMenuOpen]);

  const focusTreeItem = (sectionId: number) => {
    window.requestAnimationFrame(() => treeItemRefs.current.get(sectionId)?.focus());
  };

  const cancelSectionCreate = (parentSectionId: number | null) => {
    setNewName("");
    setSectionCreateParentId(undefined);
    window.requestAnimationFrame(() => {
      if (parentSectionId != null) {
        treeItemRefs.current.get(parentSectionId)?.focus();
        return;
      }
      document.getElementById("case-repository-new-section")?.focus();
    });
  };

  const toggleCollapsed = (sectionId: number) => {
    setCollapsedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const openQuickAddCase = (section: SectionNode) => {
    setQuickAddTitle("");
    setQuickAddFeedback(null);
    setQuickAddFocusRequest((current) => current + 1);
    setQuickAddSectionId(section.id);
    onClearExpand();
    onSelectSection(section.id);
    const ancestors = collectAncestorIds(section.id);
    setCollapsedSectionIds((current) => {
      const next = new Set(current);
      for (const id of ancestors) next.delete(id);
      next.delete(section.id);
      return next;
    });
  };

  const submitQuickAddCase = () => {
    if (selectedSectionId == null || quickAddCaseMutation.isPending) return;
    const title = normalizeQuickAddCaseTitle(quickAddTitle);
    if (title == null) {
      setQuickAddFeedback({ tone: "error", message: "Enter a case title before saving." });
      return;
    }
    setQuickAddFeedback(null);
    quickAddCaseMutation.mutate({ sectionId: selectedSectionId, title });
  };

  const queueSectionMoveCopy = (sourceSectionId: number, targetParentSectionId: number | null) => {
    const source = sectionById.get(sourceSectionId);
    if (!source) return;
    if (targetParentSectionId != null) {
      const target = sectionById.get(targetParentSectionId);
      if (!target || source.suiteId !== target.suiteId) {
        setSectionActionMessage("Sections can only be moved or copied within the same suite.");
        return;
      }
      const descendants = collectDescendantIds(sourceSectionId);
      if (sourceSectionId === targetParentSectionId || descendants.has(targetParentSectionId)) {
        setSectionActionMessage("A section cannot be moved or copied into itself or one of its child sections.");
        return;
      }
    }
    setPendingSectionMoveCopy({ sourceSectionId, targetParentSectionId });
    setSectionActionMessage(null);
  };

  const cancelSectionMoveCopy = () => {
    if (moveSectionMutation.isPending || copyMutation.isPending) return;
    setPendingSectionMoveCopy(null);
    setSectionPendingAction(null);
  };

  const confirmSectionMove = () => {
    if (!pendingSectionMoveCopy || moveSectionMutation.isPending || copyMutation.isPending) return;
    setSectionPendingAction("move");
    moveSectionMutation.mutate(pendingSectionMoveCopy);
  };

  const confirmSectionCopy = () => {
    if (!pendingSectionMoveCopy || moveSectionMutation.isPending || copyMutation.isPending) return;
    setSectionPendingAction("copy");
    copyMutation.mutate({
      sectionId: pendingSectionMoveCopy.sourceSectionId,
      targetParentSectionId: pendingSectionMoveCopy.targetParentSectionId
    });
  };

  const clearSectionDrag = () => {
    setSectionDragSourceId(null);
    setSectionDropTarget(null);
    setRootDropActive(false);
  };

  const handleSectionDragStart = (event: DragEvent<HTMLElement>, section: SectionNode) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(SECTION_DRAG_MIME, String(section.id));
    try {
      event.dataTransfer.setData("text/plain", section.name);
    } catch {
      // ignore optional drag text failures
    }
    setSectionDragSourceId(section.id);
    setSectionActionMessage(null);
  };

  const handleSectionNodeDragOver = (event: DragEvent<HTMLElement>, section: SectionNode) => {
    const sourceId = readSectionDragId(event) ?? sectionDragSourceId;
    if (sourceId == null || sourceId === section.id) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const intent = computeSectionDropIntent(event, event.currentTarget as HTMLElement);
    setSectionDropTarget((current) =>
      current?.id === section.id && current.intent === intent ? current : { id: section.id, intent }
    );
  };

  const handleSectionNodeDrop = (event: DragEvent<HTMLElement>, section: SectionNode) => {
    const sourceId = readSectionDragId(event) ?? sectionDragSourceId;
    if (sourceId == null || sourceId === section.id) {
      clearSectionDrag();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const intent = computeSectionDropIntent(event, event.currentTarget as HTMLElement);
    if (intent === "inside") {
      queueSectionMoveCopy(sourceId, section.id);
    } else {
      void reorderMutation.mutateAsync({ sourceSectionId: sourceId, targetSectionId: section.id, intent });
    }
    clearSectionDrag();
  };

  const handleRootDropOver = (event: DragEvent<HTMLElement>) => {
    const sourceId = readSectionDragId(event) ?? sectionDragSourceId;
    if (sourceId == null) return;
    const source = sectionById.get(sourceId);
    if (!source || source.parentSectionId == null) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setRootDropActive(true);
    setSectionDropTarget(null);
  };

  const handleRootDrop = (event: DragEvent<HTMLElement>) => {
    const sourceId = readSectionDragId(event) ?? sectionDragSourceId;
    if (sourceId == null) {
      clearSectionDrag();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    queueSectionMoveCopy(sourceId, null);
    clearSectionDrag();
  };

  const sourceSectionName =
    pendingSectionMoveCopy != null ? sectionById.get(pendingSectionMoveCopy.sourceSectionId)?.name ?? "section" : "section";
  const targetParentName =
    pendingSectionMoveCopy?.targetParentSectionId != null
      ? sectionById.get(pendingSectionMoveCopy.targetParentSectionId)?.name ?? "target section"
      : "root";
  const relocateSource = relocateSourceId != null ? sectionById.get(relocateSourceId) ?? null : null;
  const relocateDestinations = relocateSourceId != null ? sectionMoveDestinations(sections, relocateSourceId) : [];
  const relocateTargetLabel =
    relocateDestinations.find((destination) => destination.id === relocateTargetParentId)?.label ?? "Root level";
  const relocateTargetIsCurrent = relocateSource?.parentSectionId === relocateTargetParentId;

  const handleTreeKeyDown = (event: KeyboardEvent<HTMLLIElement>, section: SectionNode) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, [role='menu']")) return;
    const result = resolveSectionTreeKey({
      key: event.key,
      shiftKey: event.shiftKey,
      currentId: section.id,
      sections,
      collapsedIds: collapsedSectionIds
    });
    if (result.type === "none") return;
    event.preventDefault();
    event.stopPropagation();
    if (result.type === "select") {
      onClearExpand();
      onSelectSection(result.sectionId);
      setQuickAddSectionId(null);
      focusTreeItem(result.sectionId);
      return;
    }
    if (result.type === "expand") {
      setCollapsedSectionIds((current) => {
        const next = new Set(current);
        next.delete(result.sectionId);
        return next;
      });
      return;
    }
    if (result.type === "collapse") {
      setCollapsedSectionIds((current) => {
        const next = new Set(current);
        next.add(result.sectionId);
        return next;
      });
      return;
    }
    actionMenuRefs.current.get(section.id)?.open();
  };

  const renderSectionCreate = (parentSectionId: number | null) => {
    if (sectionCreateParentId !== parentSectionId) return null;
    const parentName = parentSectionId == null ? null : sectionById.get(parentSectionId)?.name ?? "section";
    const fieldId = sectionCreateFieldId(parentSectionId);
    return (
      <form
        className="flex min-w-0 items-center gap-1 py-1 pl-6 pr-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (!newName.trim() || createMutation.isPending) return;
          void createMutation.mutateAsync({ name: newName.trim(), parentSectionId });
        }}
      >
        <span aria-hidden className="w-4 shrink-0 text-center text-slate-400">
          +
        </span>
        <label className="sr-only" htmlFor={fieldId}>
          {parentName ? `New subsection in ${parentName}` : "New root section"}
        </label>
        <input
          id={fieldId}
          autoFocus
          className="min-w-0 flex-1 rounded px-2 py-1.5 text-xs text-slate-900 outline-none ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
          placeholder={parentName ? `Subsection in ${parentName}…` : "Root section name…"}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            cancelSectionCreate(parentSectionId);
          }}
        />
        <button
          type="submit"
          disabled={!newName.trim() || createMutation.isPending}
          className="rounded bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {createMutation.isPending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          aria-label="Cancel section creation"
          className="rounded px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          onClick={() => cancelSectionCreate(parentSectionId)}
        >
          Cancel
        </button>
      </form>
    );
  };

  return (
    <aside className="bg-white px-2 py-2 xl:sticky xl:top-6" aria-label="Section tree">
      <div className="relative mb-2 flex items-start justify-between gap-2 px-1" data-section-tree-menu>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Sections</p>
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {suiteSummaryQuery.data?.suiteName ?? "Test suite"}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {sections.length} section{sections.length === 1 ? "" : "s"}
            {suiteSummaryQuery.isLoading
              ? " · loading cases…"
              : suiteSummaryQuery.data?.activeCaseCount != null
                ? ` · ${suiteSummaryQuery.data.activeCaseCount} case${suiteSummaryQuery.data.activeCaseCount === 1 ? "" : "s"}`
                : ""}
          </p>
        </div>
        <button
          ref={suiteMenuButtonRef}
          type="button"
          aria-label="Suite options"
          aria-haspopup="menu"
          aria-expanded={suiteMenuOpen}
          className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          onClick={() => setSuiteMenuOpen((current) => !current)}
        >
          •••
        </button>
        {suiteMenuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-8 z-20 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
          >
            <p className="px-2 py-1.5 text-[11px] leading-relaxed text-slate-500">
              {suiteSummaryQuery.data?.suiteDescription || "No suite description yet."}
            </p>
            {suiteSummaryQuery.data?.totalEstimateDisplay ? (
              <p className="px-2 pb-1.5 text-[11px] text-slate-500">
                Forecast {suiteSummaryQuery.data.totalEstimateDisplay} · {suiteSummaryQuery.data.casesWithEstimateCount} estimated
              </p>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="block w-full rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setSuiteMenuOpen(false);
                setDescriptionError(null);
                setDescriptionDialogOpen(true);
              }}
            >
              Edit suite description
            </button>
            {onToggleTreeSide ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full rounded px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  setSuiteMenuOpen(false);
                  onToggleTreeSide();
                }}
              >
                Move tree to {treeSide === "right" ? "left" : "right"}
              </button>
            ) : null}
            <p className="border-t border-slate-100 px-2 py-2 text-[10px] leading-relaxed text-slate-400">
              Shortcuts: J/K navigate · C add case · S add section
            </p>
          </div>
        ) : null}
      </div>

      {onAddTestCase ? (
        <button
          type="button"
          onClick={onAddTestCase}
          className="mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-blue-700 hover:bg-blue-50"
        >
          <span aria-hidden>+</span> Add test case
        </button>
      ) : null}

      {sectionDragSourceId != null ? (
        <div
          className={
            "mt-3 rounded-md border px-3 py-2 text-xs transition " +
            (rootDropActive
              ? "border-emerald-400 bg-emerald-50 text-emerald-800"
              : "border-dashed border-emerald-300 bg-white text-slate-600")
          }
          onDragOver={handleRootDropOver}
          onDragLeave={() => setRootDropActive(false)}
          onDrop={handleRootDrop}
        >
          Drop to root
        </div>
      ) : null}

      <ul role="tree" aria-label="Sections" className="mt-1">
        {(() => {
          const roots = sectionByParent.get(null) ?? [];
          const treeTabId = selectedSectionId ?? roots[0]?.id ?? null;
          return roots.map((root) => {
            const walk = (section: SectionNode, depth: number): ReactNode => {
            const selected = selectedSectionId != null && section.id === selectedSectionId;
            const isEditing = editingId === section.id;
            const children = sectionByParent.get(section.id) ?? [];
            const collapsed = collapsedSectionIds.has(section.id);
            const pathLabel = sectionPathLabel(sections, section.id);
            return (
              <li
                key={section.id}
                ref={(element) => {
                  if (element) treeItemRefs.current.set(section.id, element);
                  else treeItemRefs.current.delete(section.id);
                }}
                role="treeitem"
                tabIndex={section.id === treeTabId ? 0 : -1}
                aria-label={pathLabel}
                aria-level={depth + 1}
                aria-selected={selected}
                aria-expanded={children.length > 0 ? !collapsed : undefined}
                onKeyDown={(event) => handleTreeKeyDown(event, section)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isEditing) return;
                  onClearExpand();
                  onSelectSection(section.id);
                  setQuickAddSectionId(null);
                }}
                className="rounded focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
              >
                {isEditing ? (
                  <div className="flex items-center gap-1 py-1 pl-6 pr-1">
                    <FolderIcon open={false} />
                    <input
                      autoFocus
                      aria-label={`Rename ${section.name}`}
                      className="min-w-0 flex-1 rounded px-2 py-1.5 text-xs outline-none ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-blue-500"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded bg-slate-900 px-2 py-1.5 text-xs text-white"
                      disabled={renameMutation.isPending}
                      onClick={() =>
                        void renameMutation.mutateAsync({
                          id: section.id,
                          name: editName.trim() || section.name
                        })
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                      onClick={() => {
                        setEditingId(null);
                        setEditName("");
                        focusTreeItem(section.id);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    className={`group relative flex h-9 items-center rounded px-1 ${
                      selected
                        ? "bg-blue-50 text-blue-950 shadow-[inset_2px_0_0_#2563eb]"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    data-section-tree-menu
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={children.length > 0 ? `${collapsed ? "Expand" : "Collapse"} ${section.name}` : ""}
                      disabled={children.length === 0}
                      className="flex h-7 w-5 shrink-0 items-center justify-center text-slate-500 hover:text-slate-900 disabled:invisible"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleCollapsed(section.id);
                      }}
                    >
                      {children.length > 0 ? <ChevronIcon expanded={!collapsed} /> : null}
                    </button>
                    {(() => {
                      const isDropHover = dnd?.hoveredSectionId === section.id;
                      const isDropEligible =
                        dnd?.isDragging === true && dnd?.sourceSectionId !== section.id;
                      const sectionDropIntent =
                        sectionDropTarget?.id === section.id ? sectionDropTarget.intent : null;
                      const baseClass =
                        "flex min-w-0 flex-1 items-center gap-2 self-stretch px-1 text-left text-sm " +
                        (selected ? "font-semibold text-blue-950" : "font-medium text-slate-700");
                      const caseDropClass = isDropHover
                        ? " ring-2 ring-sky-500 ring-offset-1 ring-offset-white"
                        : isDropEligible
                          ? " ring-1 ring-dashed ring-sky-300"
                          : "";
                      const sectionDropClass =
                        sectionDropIntent === "inside"
                          ? " ring-2 ring-emerald-500 ring-offset-1 ring-offset-white"
                          : sectionDropIntent === "before"
                            ? " border-t-4 border-t-emerald-500"
                            : sectionDropIntent === "after"
                              ? " border-b-4 border-b-emerald-500"
                              : sectionDragSourceId != null && sectionDragSourceId !== section.id
                                ? " ring-1 ring-dashed ring-emerald-300"
                                : "";
                      return (
                        <button
                          type="button"
                          tabIndex={-1}
                          draggable={!isEditing && !reorderMutation.isPending}
                          onDragStart={(event) => handleSectionDragStart(event, section)}
                          onDragEnd={clearSectionDrag}
                          onClick={() => {
                            onClearExpand();
                            onSelectSection(section.id);
                            setQuickAddSectionId(null);
                            focusTreeItem(section.id);
                          }}
                          className={baseClass + caseDropClass + sectionDropClass}
                          onDragOver={(event) => {
                            if (hasSectionDrag(event, sectionDragSourceId)) {
                              handleSectionNodeDragOver(event, section);
                              return;
                            }
                            dnd?.onDragOver(event, section.id);
                          }}
                          onDragLeave={() => {
                            setSectionDropTarget((current) => (current?.id === section.id ? null : current));
                            dnd?.onDragLeave(section.id);
                          }}
                          onDrop={(event) => {
                            if (hasSectionDrag(event, sectionDragSourceId)) {
                              handleSectionNodeDrop(event, section);
                              return;
                            }
                            dnd?.onDrop(event, section.id);
                          }}
                          aria-label={
                            sectionDropIntent
                              ? `Drop section ${sectionDropIntent} ${section.name}`
                              : isDropEligible
                              ? `Drop ${dnd?.draggingCount ?? 0} case${(dnd?.draggingCount ?? 0) === 1 ? "" : "s"} on ${section.name}`
                              : undefined
                          }
                        >
                          <span className={selected ? "text-blue-700" : "text-slate-500"}>
                            <FolderIcon open={children.length > 0 && !collapsed} />
                          </span>
                          <span className="truncate">{section.name}</span>
                        </button>
                      );
                    })()}
                    {selected ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Add case to ${section.name}`}
                        className="shrink-0 rounded px-2 py-1 text-sm font-medium text-blue-700 hover:bg-white"
                        onClick={(event) => {
                          event.stopPropagation();
                          openQuickAddCase(section);
                        }}
                      >
                        +
                      </button>
                    ) : null}
                    <OverflowMenu
                      ref={(handle) => {
                        if (handle) actionMenuRefs.current.set(section.id, handle);
                        else actionMenuRefs.current.delete(section.id);
                      }}
                      iconOnly
                      compact
                      variant="ghost"
                      size="sm"
                      align="right"
                      label={`${section.name} actions`}
                      triggerTabIndex={-1}
                      triggerClassName={`h-7 min-w-7 px-2 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-900 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${
                        selected ? "sm:opacity-100" : ""
                      }`}
                      groups={[
                        {
                          id: "actions",
                          label: "",
                          items: [
                            {
                              id: "add-case",
                              label: `Add case to ${section.name}`,
                              onSelect: () => openQuickAddCase(section)
                            },
                            {
                              id: "add-subsection",
                              label: `Add subsection to ${section.name}`,
                              onSelect: () => {
                                setNewName("");
                                setSectionCreateParentId(section.id);
                                setCollapsedSectionIds((current) => {
                                  const next = new Set(current);
                                  next.delete(section.id);
                                  return next;
                                });
                              }
                            },
                            {
                              id: "rename",
                              label: "Rename section",
                              onSelect: () => {
                                setEditingId(section.id);
                                setEditName(section.name);
                              }
                            },
                            {
                              id: "move",
                              label: "Move or copy…",
                              onSelect: () => {
                                setRelocateSourceId(section.id);
                                setRelocateTargetParentId(section.parentSectionId ?? null);
                              }
                            },
                            {
                              id: "delete",
                              label: "Delete section",
                              tone: "danger",
                              onSelect: () => setDeleteTarget(section)
                            }
                          ]
                        }
                      ]}
                    />
                  </div>
                )}
                {quickAddSectionId === section.id ? (
                  <SectionTreeQuickAddCase
                    sectionName={section.name}
                    title={quickAddTitle}
                    onTitleChange={(value) => {
                      setQuickAddTitle(value);
                      setQuickAddFeedback(null);
                    }}
                    feedback={quickAddFeedback}
                    isPending={quickAddCaseMutation.isPending}
                    focusRequest={quickAddFocusRequest}
                    onSubmit={submitQuickAddCase}
                  />
                ) : null}
                {renderSectionCreate(section.id)}
                {children.length > 0 && !collapsed ? (
                  <ul role="group" className="ml-[11px] border-l border-slate-200 pl-1">
                    {children.map((child) => walk(child, depth + 1))}
                  </ul>
                ) : null}
              </li>
            );
          };
          return walk(root, 0);
        });
        })()}
      </ul>

      {suiteId ? (
        sectionCreateParentId === null ? (
          renderSectionCreate(null)
        ) : (
          <button
            id="case-repository-new-section"
            type="button"
            className="mt-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            onClick={() => {
              setNewName("");
              setSectionCreateParentId(null);
            }}
          >
            <span aria-hidden className="w-4 text-center text-slate-400">+</span>
            Add root section
          </button>
        )
      ) : (
        <p className="mt-2 text-xs text-slate-500">No suite found. Create a suite first.</p>
      )}

      {sectionActionMessage ? <p className="mt-2 text-xs text-slate-600">{sectionActionMessage}</p> : null}
      {deleteError ? <p className="mt-2 text-xs text-red-700">{deleteError}</p> : null}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete section?"
        description={
          deleteTarget ? (
            <p>
              <span className="font-medium">{deleteTarget.name}</span> will be removed after the section tree is empty.
            </p>
          ) : null
        }
        confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete"}
        confirmDisabled={deleteMutation.isPending}
        variant="danger"
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (deleteTarget) void deleteMutation.mutateAsync(deleteTarget.id);
        }}
      />
      <MoveCopyChooserDialog
        open={pendingSectionMoveCopy != null}
        title="Move or copy section?"
        description={
          <p>
            <span className="font-medium text-slate-800">{sourceSectionName}</span> will be placed under{" "}
            <span className="font-medium text-slate-800">{targetParentName}</span>. Moving keeps the existing subtree;
            copying creates a new subtree with copied cases.
          </p>
        }
        busy={moveSectionMutation.isPending || copyMutation.isPending}
        pendingAction={sectionPendingAction}
        onMove={confirmSectionMove}
        onCopy={confirmSectionCopy}
        onCancel={cancelSectionMoveCopy}
      />
      <MoveCopyChooserDialog
        open={relocateSource != null}
        title="Move or copy section"
        description={
          relocateSource ? (
            <div className="space-y-3">
              <p>
                Choose where <span className="font-medium text-slate-800">{sectionPathLabel(sections, relocateSource.id)}</span>{" "}
                should be placed.
              </p>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Destination
                <select
                  aria-label="Section destination"
                  value={relocateTargetParentId ?? ""}
                  onChange={(event) =>
                    setRelocateTargetParentId(event.target.value ? Number(event.target.value) : null)
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {relocateDestinations.map((destination) => (
                    <option key={destination.id ?? "root"} value={destination.id ?? ""}>
                      {destination.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Destination: <span className="font-medium text-slate-800">{relocateTargetLabel}</span>
                {relocateTargetIsCurrent ? <span className="text-slate-400"> · current location</span> : null}
              </p>
            </div>
          ) : null
        }
        busy={moveSectionMutation.isPending || copyMutation.isPending}
        pendingAction={sectionPendingAction}
        disabled={!relocateSource}
        moveDisabled={relocateTargetIsCurrent}
        onMove={() => {
          if (!relocateSource) return;
          setSectionPendingAction("move");
          moveSectionMutation.mutate({
            sourceSectionId: relocateSource.id,
            targetParentSectionId: relocateTargetParentId
          });
        }}
        onCopy={() => {
          if (!relocateSource) return;
          setSectionPendingAction("copy");
          copyMutation.mutate({
            sectionId: relocateSource.id,
            targetParentSectionId: relocateTargetParentId
          });
        }}
        onCancel={() => {
          setRelocateSourceId(null);
          setSectionPendingAction(null);
        }}
      />
      <SuiteDescriptionDialog
        open={descriptionDialogOpen}
        suiteName={suiteSummaryQuery.data?.suiteName ?? "Test suite"}
        description={suiteSummaryQuery.data?.suiteDescription ?? ""}
        isSaving={updateSuiteDescriptionMutation.isPending}
        error={descriptionError}
        onSave={(next) => void updateSuiteDescriptionMutation.mutateAsync(next)}
        onClose={() => {
          setDescriptionDialogOpen(false);
          setDescriptionError(null);
        }}
      />
    </aside>
  );
}
