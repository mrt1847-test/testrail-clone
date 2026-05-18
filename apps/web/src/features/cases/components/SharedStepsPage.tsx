import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ProjectContentHeader } from "../../projects/content-header/ProjectContentHeader";
import { buildCaseListPath } from "../caseRoute";
import {
  createSharedStep,
  deleteSharedStep,
  fetchSharedSteps,
  updateSharedStep,
  type SharedStepSummary
} from "../api/sharedStepsApi";
import { SharedStepEditorDialog } from "./SharedStepEditorDialog";

const sharedStepKeys = {
  all: (projectId: string) => ["shared-steps", projectId] as const
};

export function SharedStepsPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SharedStepSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SharedStepSummary | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: sharedStepKeys.all(projectId),
    queryFn: () => fetchSharedSteps(projectId),
    enabled: Boolean(projectId)
  });

  const saveMutation = useMutation({
    mutationFn: (input: { title: string; entries: Array<{ content: string; expectedResult?: string | null }> }) =>
      editing
        ? updateSharedStep(projectId, editing.id, input)
        : createSharedStep(projectId, input),
    onSuccess: () => {
      setFormError(null);
      setEditorOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: sharedStepKeys.all(projectId) });
    },
    onError: () => {
      setFormError("Could not save shared steps.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (sharedStepId: string) => deleteSharedStep(projectId, sharedStepId),
    onSuccess: () => {
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: sharedStepKeys.all(projectId) });
    }
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectContentHeader
        projectId={projectId}
        title="Shared Steps"
        subtitle="Reusable step groups linked from multiple test cases."
        variant="cases"
      />
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Shared test steps</h2>
              <p className="mt-1 text-sm text-slate-600">
                Reusable step groups linked from multiple test cases. Updates propagate to linked cases.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={buildCaseListPath(projectId)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Back to test cases
              </Link>
              <button
                type="button"
                className="rounded border border-blue-900 bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
                onClick={() => {
                  setEditing(null);
                  setFormError(null);
                  setEditorOpen(true);
                }}
              >
                Add shared steps
              </button>
            </div>
          </div>

          {listQuery.isLoading ? <LoadingState message="Loading shared steps..." /> : null}
          {listQuery.isError ? (
            <ErrorState title="Could not load shared steps" onRetry={() => void listQuery.refetch()} />
          ) : null}

          {listQuery.data && listQuery.data.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
              No shared steps yet. Create a group to reuse across test cases.
            </div>
          ) : null}

          {listQuery.data && listQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Steps</th>
                    <th className="px-3 py-2">Linked cases</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{row.title}</td>
                      <td className="px-3 py-2 text-slate-600">{row.entries.length}</td>
                      <td className="px-3 py-2 text-slate-600">{row.linkedCaseCount}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="mr-2 text-xs font-medium text-blue-700 hover:underline"
                          onClick={() => {
                            setEditing(row);
                            setFormError(null);
                            setEditorOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-red-700 hover:underline"
                          onClick={() => setDeleteTarget(row)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <SharedStepEditorDialog
        open={editorOpen}
        initial={editing}
        busy={saveMutation.isPending}
        error={formError}
        onCancel={() => {
          if (saveMutation.isPending) return;
          setEditorOpen(false);
          setEditing(null);
          setFormError(null);
        }}
        onSave={(input) => saveMutation.mutate(input)}
      />

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900">Delete shared steps?</h3>
            <p className="mt-2 text-sm text-slate-600">
              &ldquo;{deleteTarget.title}&rdquo; will be removed. Linked case steps keep their current text.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1 text-xs"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border border-red-700 bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
