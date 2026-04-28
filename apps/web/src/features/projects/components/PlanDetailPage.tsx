import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { createPlanEntry, createRunFromPlanEntry, fetchPlan, fetchPlanEntries } from "../api/advancedApi";

export function PlanDetailPage() {
  const { projectId = "", planId = "" } = useParams();
  const qc = useQueryClient();
  const [entryName, setEntryName] = useState("");
  const [entryEnvironment, setEntryEnvironment] = useState("");
  const planQuery = useQuery({
    queryKey: ["plan", projectId, planId],
    queryFn: () => fetchPlan(projectId, planId),
    enabled: Boolean(projectId && planId)
  });
  const entriesQuery = useQuery({
    queryKey: ["plan-entries", projectId, planId],
    queryFn: () => fetchPlanEntries(projectId, planId),
    enabled: Boolean(projectId && planId)
  });
  const createEntryMutation = useMutation({
    mutationFn: (input: { name: string; environment?: string }) => createPlanEntry(projectId, planId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
      setEntryName("");
      setEntryEnvironment("");
    }
  });
  const createRunMutation = useMutation({
    mutationFn: (entryId?: string) => createRunFromPlanEntry(projectId, planId, entryId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
    }
  });

  if (planQuery.isLoading || entriesQuery.isLoading) return <LoadingState message="Loading test plan detail…" />;
  if (planQuery.isError || entriesQuery.isError || !planQuery.data) {
    return <ErrorState title="Could not load test plan detail" onRetry={() => void Promise.all([planQuery.refetch(), entriesQuery.refetch()])} />;
  }

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Test Plan</p>
        <h2 className="text-xl font-semibold text-slate-900">{planQuery.data.name}</h2>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Add plan entry</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-48 flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Entry name"
            value={entryName}
            onChange={(e) => setEntryName(e.target.value)}
          />
          <input
            className="min-w-40 flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Environment (optional)"
            value={entryEnvironment}
            onChange={(e) => setEntryEnvironment(e.target.value)}
          />
          <button
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={!entryName.trim() || createEntryMutation.isPending}
            onClick={() =>
              void createEntryMutation.mutateAsync({
                name: entryName.trim(),
                environment: entryEnvironment.trim() || undefined
              })
            }
          >
            Add entry
          </button>
          <button
            className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={createRunMutation.isPending || !entriesQuery.data || entriesQuery.data.length === 0}
            onClick={() => void createRunMutation.mutateAsync(undefined)}
          >
            Generate run (first entry)
          </button>
        </div>
      </section>

      {entriesQuery.data && entriesQuery.data.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Plan Entries</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {entriesQuery.data.map((entry) => (
              <li key={entry.id} className="rounded border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-800">{entry.name}</p>
                <p className="text-xs text-slate-500">environment: {entry.environment || "n/a"}</p>
                {!entry.runId ? (
                  <button
                    className="mt-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                    disabled={createRunMutation.isPending}
                    onClick={() => void createRunMutation.mutateAsync(entry.id)}
                  >
                    Generate run for this entry
                  </button>
                ) : null}
                {entry.runId ? (
                  <Link to={`/projects/${projectId}/runs/${entry.runId}`} className="text-xs text-slate-700 underline">
                    linked run #{entry.runId}
                  </Link>
                ) : (
                  <p className="text-xs text-slate-500">no linked run</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState title="No plan entries" description="Environment entries will appear here." />
      )}
    </div>
  );
}
