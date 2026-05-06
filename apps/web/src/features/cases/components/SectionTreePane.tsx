import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import { createSection, deleteSection, updateSection } from "../api/catalogApi";
import { caseKeys } from "../hooks/useCases";
import { sectionKeys } from "../hooks/useSections";
import type { SectionNode } from "../types";

type SectionTreePaneProps = {
  suiteId: string;
  sections: SectionNode[];
  selectedSectionId: number;
  onSelectSection: (id: number) => void;
  onClearExpand: () => void;
};

export function SectionTreePane({
  suiteId,
  sections,
  selectedSectionId,
  onSelectSection,
  onClearExpand
}: SectionTreePaneProps) {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SectionNode | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const sectionByParent = sections.reduce<Map<number | null, SectionNode[]>>((acc, section) => {
    const parent = section.parentSectionId ?? null;
    const list = acc.get(parent);
    if (list) list.push(section);
    else acc.set(parent, [section]);
    return acc;
  }, new Map());

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

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-6">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Repository</p>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">Sections</h3>
        <p className="mt-1 text-xs text-slate-500">
          Keep navigation focused here, then review and edit the selected case in the workspace.
        </p>
      </div>

      {suiteId ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            placeholder="New section name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!newName.trim() || createMutation.isPending}
              className="rounded-xl bg-slate-900 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
              onClick={() => void createMutation.mutateAsync({ name: newName.trim(), parentSectionId: null })}
            >
              Add root
            </button>
            <button
              type="button"
              disabled={!newName.trim() || createMutation.isPending}
              className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 disabled:opacity-50"
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

      <ul className="mt-3 grid gap-1.5">
        {(sectionByParent.get(null) ?? []).map((root) => {
          const walk = (section: SectionNode, depth: number): ReactNode => {
            const selected = section.id === selectedSectionId;
            const isEditing = editingId === section.id;
            const children = sectionByParent.get(section.id) ?? [];
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
                      onClick={() => {
                        onSelectSection(section.id);
                        onClearExpand();
                        setActionMenuId(null);
                      }}
                      className={
                        selected
                          ? "min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white"
                          : "min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                      }
                      style={{ paddingLeft: `${depth * 16 + 12}px` }}
                    >
                      {section.name}
                    </button>
                    <button
                      type="button"
                      aria-expanded={actionMenuId === section.id}
                      className="shrink-0 rounded-xl border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      onClick={() => setActionMenuId((current) => (current === section.id ? null : section.id))}
                    >
                      •••
                    </button>
                    {actionMenuId === section.id ? (
                      <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
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
                {children.length > 0 ? (
                  <ul className="mt-1 grid gap-1.5">{children.map((child) => walk(child, depth + 1))}</ul>
                ) : null}
              </li>
            );
          };
          return walk(root, 0);
        })}
      </ul>

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
    </aside>
  );
}
