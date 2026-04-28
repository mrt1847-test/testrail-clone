import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { createPlan, fetchPlans } from "../api/advancedApi";

export function PlansPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [newPlanName, setNewPlanName] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["plans", projectId],
    queryFn: () => fetchPlans(projectId),
    enabled: Boolean(projectId)
  });
  const createPlanMutation = useMutation({
    mutationFn: (name: string) => createPlan(projectId, name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
      setNewPlanName("");
    }
  });

  if (isLoading) return <LoadingState message="Loading test plans…" />;
  if (isError) return <ErrorState title="Could not load test plans" onRetry={() => refetch()} />;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Create test plan</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="e.g. Release 1.2 matrix"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
          />
          <button
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={!newPlanName.trim() || createPlanMutation.isPending}
            onClick={() => void createPlanMutation.mutateAsync(newPlanName.trim())}
          >
            Add plan
          </button>
        </div>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState title="No plans yet" description="Environment matrix plans will appear here." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Test Plans</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-800">
            {data.map((row) => (
              <li key={row.id} className="rounded border border-slate-200 px-3 py-2">
                <Link to={`/projects/${projectId}/plans/${row.id}`} className="underline">
                  {row.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
