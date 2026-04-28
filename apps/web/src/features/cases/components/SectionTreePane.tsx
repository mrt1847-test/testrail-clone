import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import { createSection, deleteSection, updateSection } from "../api/catalogApi";
import { caseKeys } from "../hooks/useCases";
import type { SectionNode } from "../types";
import { sectionKeys } from "../hooks/useSections";

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
  const [deleteTarget, setDeleteTarget] = useState<SectionNode | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: sectionKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: caseKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
    void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
  };

  const createMutation = useMutation({
    mutationFn: (name: string) => createSection(suiteId, name),
    onSuccess: () => {
      invalidate();
      setNewName("");
    }
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateSection(id, name),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSection(id),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      onClearExpand();
    }
  });

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Section tree</h3>

      {suiteId ? (
        <div className="mt-3 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs"
            placeholder="New section name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="button"
            disabled={!newName.trim() || createMutation.isPending}
            className="rounded bg-slate-900 px-2 py-1.5 text-xs text-white disabled:opacity-50"
            onClick={() => void createMutation.mutateAsync(newName.trim())}
          >
            Add
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">No suite found — create a suite first.</p>
      )}

      <ul className="mt-3 grid gap-1">
        {sections.map((section) => {
          const selected = section.id === selectedSectionId;
          const isEditing = editingId === section.id;
          return (
            <li key={section.id} className="rounded-md border border-slate-100 p-1">
              {isEditing ? (
                <div className="flex gap-1">
                  <input
                    className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    disabled={renameMutation.isPending}
                    onClick={() => void renameMutation.mutateAsync({ id: section.id, name: editName.trim() || section.name })}
                  >
                    Save
                  </button>
                  <button type="button" className="rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSection(section.id);
                      onClearExpand();
                    }}
                    className={
                      selected
                        ? "min-w-0 flex-1 rounded-md bg-slate-900 px-2 py-2 text-left text-sm font-medium text-white"
                        : "min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    }
                  >
                    {section.name}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      setEditingId(section.id);
                      setEditName(section.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-red-100 px-1.5 py-1 text-[10px] text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteTarget(section)}
                  >
                    Del
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete section?"
        description={
          deleteTarget ? (
            <p>
              <span className="font-medium">{deleteTarget.name}</span> 및 이 섹션에 속한 케이스 연결을 삭제할 수 있습니다. 서버 정책에 따라 케이스가 있으면 실패할 수 있습니다.
            </p>
          ) : null
        }
        confirmLabel={deleteMutation.isPending ? "Deleting…" : "Delete"}
        confirmDisabled={deleteMutation.isPending}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteMutation.mutateAsync(deleteTarget.id);
        }}
      />
    </aside>
  );
}
