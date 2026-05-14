import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import { copySectionSubtree, createSection, deleteSection, reorderSections, updateSection } from "../api/catalogApi";
import { caseKeys } from "../hooks/useCases";
import { sectionKeys } from "../hooks/useSections";
import type { SectionNode } from "../types";
import { MoveCopyChooserDialog } from "./MoveCopyChooserDialog";

const SECTION_DRAG_MIME = "application/x-testrail-section-id";
type SectionDropIntent = "before" | "after" | "inside";
type PendingSectionMoveCopy = {
  sourceSectionId: number;
  targetParentSectionId: number | null;
};

type SectionTreePaneProps = {
  suiteId: string;
  sections: SectionNode[];
  selectedSectionId: number;
  onSelectSection: (id: number) => void;
  onClearExpand: () => void;
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
  dnd
}: SectionTreePaneProps) {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SectionNode | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sectionDragSourceId, setSectionDragSourceId] = useState<number | null>(null);
  const [sectionDropTarget, setSectionDropTarget] = useState<{ id: number; intent: SectionDropIntent } | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const [pendingSectionMoveCopy, setPendingSectionMoveCopy] = useState<PendingSectionMoveCopy | null>(null);
  const [sectionPendingAction, setSectionPendingAction] = useState<"move" | "copy" | null>(null);
  const [sectionActionMessage, setSectionActionMessage] = useState<string | null>(null);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<number>>(new Set());
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
    void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
    void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
  };

  const createMutation = useMutation({
    mutationFn: ({ name, parentSectionId }: { name: string; parentSectionId?: number | null }) =>
      createSection(suiteId, name, parentSectionId),
    onSuccess: () => {
      invalidate();
      setNewName("");
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
      setActionMenuId(null);
      setPendingSectionMoveCopy(null);
      setSectionPendingAction(null);
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
    const validSectionIds = new Set(sections.map((section) => section.id));
    const ancestors = collectAncestorIds(selectedSectionId);
    setCollapsedSectionIds((current) => {
      const next = new Set(Array.from(current).filter((id) => validSectionIds.has(id) && !ancestors.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [sections, selectedSectionId]);

  const toggleCollapsed = (sectionId: number) => {
    setCollapsedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const copyUnderSelected = (section: SectionNode) => {
    if (copyMutation.isPending) return;
    const targetParentSectionId = selectedSectionId === section.id ? null : selectedSectionId;
    const descendants = collectDescendantIds(section.id);
    if (targetParentSectionId != null && descendants.has(targetParentSectionId)) {
      setSectionActionMessage("A section cannot be copied under itself or one of its child sections.");
      return;
    }
    void copyMutation.mutateAsync({ sectionId: section.id, targetParentSectionId });
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

  return (
    <aside className="rounded-md border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-6">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Sections</h3>
      </div>

      {suiteId ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs"
            placeholder="New section name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!newName.trim() || createMutation.isPending}
              className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
              onClick={() => void createMutation.mutateAsync({ name: newName.trim(), parentSectionId: null })}
            >
              Add
            </button>
            <button
              type="button"
              disabled={!newName.trim() || createMutation.isPending}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 disabled:opacity-50"
              onClick={() =>
                void createMutation.mutateAsync({
                  name: newName.trim(),
                  parentSectionId: selectedSectionId
                })
              }
            >
              Add child
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No suite found. Create a suite first.</p>
      )}

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

      <ul className="mt-3 grid gap-1.5">
        {(sectionByParent.get(null) ?? []).map((root) => {
          const walk = (section: SectionNode, depth: number): ReactNode => {
            const selected = section.id === selectedSectionId;
            const isEditing = editingId === section.id;
            const children = sectionByParent.get(section.id) ?? [];
            const collapsed = collapsedSectionIds.has(section.id);
            return (
              <li key={section.id} className="rounded-xl border border-slate-100 bg-white p-1.5">
                {isEditing ? (
                  <div className="flex gap-1">
                    <input
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 px-2 py-1.5 text-xs"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs"
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
                      className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs"
                      onClick={() => {
                        setEditingId(null);
                        setEditName("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="relative flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={children.length > 0 ? `${collapsed ? "Expand" : "Collapse"} ${section.name}` : ""}
                      disabled={children.length === 0}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:invisible"
                      style={{ marginLeft: `${depth * 16}px` }}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleCollapsed(section.id);
                      }}
                    >
                      {children.length > 0 ? (collapsed ? "+" : "-") : ""}
                    </button>
                    {(() => {
                      const isDropHover = dnd?.hoveredSectionId === section.id;
                      const isDropEligible =
                        dnd?.isDragging === true && dnd?.sourceSectionId !== section.id;
                      const sectionDropIntent =
                        sectionDropTarget?.id === section.id ? sectionDropTarget.intent : null;
                      const baseClass = selected
                        ? "min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white"
                        : "min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50";
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
                          draggable={!isEditing && !reorderMutation.isPending}
                          onDragStart={(event) => handleSectionDragStart(event, section)}
                          onDragEnd={clearSectionDrag}
                          onClick={() => {
                            onSelectSection(section.id);
                            onClearExpand();
                            setActionMenuId(null);
                          }}
                          className={baseClass + caseDropClass + sectionDropClass}
                          style={{ paddingLeft: "12px" }}
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
                              : section.name
                          }
                        >
                          {section.name}
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      aria-expanded={actionMenuId === section.id}
                      className="shrink-0 rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      onClick={() => setActionMenuId((current) => (current === section.id ? null : section.id))}
                    >
                      •••
                    </button>
                    {actionMenuId === section.id ? (
                      <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            setEditingId(section.id);
                            setEditName(section.name);
                            setActionMenuId(null);
                          }}
                        >
                          Rename section
                        </button>
                        <button
                          type="button"
                          disabled={copyMutation.isPending}
                          className="block w-full rounded-xl px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => copyUnderSelected(section)}
                        >
                          Copy under selected
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded-xl px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setDeleteTarget(section);
                            setActionMenuId(null);
                          }}
                        >
                          Delete section
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
                {children.length > 0 && !collapsed ? (
                  <ul className="mt-1 grid gap-1.5">{children.map((child) => walk(child, depth + 1))}</ul>
                ) : null}
              </li>
            );
          };
          return walk(root, 0);
        })}
      </ul>

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
    </aside>
  );
}
