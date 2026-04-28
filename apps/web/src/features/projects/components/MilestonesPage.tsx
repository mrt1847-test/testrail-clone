import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { createMilestone, deleteMilestone, fetchMilestones, updateMilestone } from "../api/advancedApi";

export function MilestonesPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId)
  });
  const createMutation = useMutation({
    mutationFn: (name: string) => createMilestone(projectId, name),
    onSuccess: () => {
      setNewMilestoneName("");
      void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
    }
  });
  const updateMutation = useMutation({
    mutationFn: (input: { milestoneId: string; isCompleted: boolean }) =>
      updateMilestone({ projectId, milestoneId: input.milestoneId, isCompleted: input.isCompleted }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (milestoneId: string) => deleteMilestone(projectId, milestoneId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
    }
  });

  if (isLoading) return <LoadingState message="Loading milestones…" />;
  if (isError) return <ErrorState title="Could not load milestones" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Create milestone</h2>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="e.g. Sprint 12 / Release 2.1"
            value={newMilestoneName}
            onChange={(e) => setNewMilestoneName(e.target.value)}
          />
          <button
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={!newMilestoneName.trim() || createMutation.isPending}
            onClick={() => void createMutation.mutateAsync(newMilestoneName.trim())}
          >
            Add
          </button>
        </div>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState title="No milestones yet" description="Milestone list will appear here." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Milestones</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-800">
            {data.map((row) => (
              <li key={row.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                <Link to={`/projects/${projectId}/milestones/${row.id}`} className="underline">
                  {row.name}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{row.isCompleted ? "completed" : "open"}</span>
                  <button
                    className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      void updateMutation.mutateAsync({
                        milestoneId: row.id,
                        isCompleted: !row.isCompleted
                      })
                    }
                  >
                    {row.isCompleted ? "Reopen" : "Complete"}
                  </button>
                  <button
                    className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:opacity-50"
                    disabled={deleteMutation.isPending}
                    onClick={() => void deleteMutation.mutateAsync(row.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
