import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchPlan, fetchPlanEntries } from "../api/advancedApi";

export function PlanDetailPage() {
  const { projectId = "", planId = "" } = useParams();
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

      {entriesQuery.data && entriesQuery.data.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Plan Entries</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {entriesQuery.data.map((entry) => (
              <li key={entry.id} className="rounded border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-800">{entry.name}</p>
                <p className="text-xs text-slate-500">environment: {entry.environment || "n/a"}</p>
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
