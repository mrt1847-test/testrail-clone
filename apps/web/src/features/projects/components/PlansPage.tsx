import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import { buildPlanPrintPath } from "../../print/api/printApi";
import { createPlan, deletePlan, fetchPlans, updatePlan } from "../api/advancedApi";

export function PlansPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [newPlanName, setNewPlanName] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingPlanName, setEditingPlanName] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["plans", projectId],
    queryFn: () => fetchPlans(projectId),
    enabled: Boolean(projectId)
  });
  const createPlanMutation = useMutation({
    mutationFn: (name: string) => createPlan(projectId, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
      setNewPlanName("");
    }
  });
  const updatePlanMutation = useMutation({
    mutationFn: (input: { planId: string; name: string }) => updatePlan(projectId, input.planId, { name: input.name }),
    onSuccess: () => {
      setEditingPlanId(null);
      setEditingPlanName("");
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
    }
  });
  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => deletePlan(projectId, planId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
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
                {editingPlanId === row.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                      value={editingPlanName}
                      onChange={(e) => setEditingPlanName(e.target.value)}
                    />
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                      disabled={!editingPlanName.trim() || updatePlanMutation.isPending}
                      onClick={() =>
                        void updatePlanMutation.mutateAsync({ planId: row.id, name: editingPlanName.trim() })
                      }
                    >
                      Save
                    </button>
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                      onClick={() => {
                        setEditingPlanId(null);
                        setEditingPlanName("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/projects/${projectId}/plans/${row.id}`} className="underline">
                      {row.name}
                    </Link>
                    <div className="flex items-center gap-1">
                      <PrintLinkButton
                        to={buildPlanPrintPath(projectId, row.id)}
                        label="Print"
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      />
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => {
                          setEditingPlanId(row.id);
                          setEditingPlanName(row.name);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:opacity-50"
                        disabled={deletePlanMutation.isPending}
                        onClick={() => void deletePlanMutation.mutateAsync(row.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
