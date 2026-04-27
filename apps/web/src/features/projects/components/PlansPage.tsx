import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchPlans } from "../api/advancedApi";

export function PlansPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["plans", projectId],
    queryFn: () => fetchPlans(projectId),
    enabled: Boolean(projectId)
  });

  if (isLoading) return <LoadingState message="Loading test plans…" />;
  if (isError) return <ErrorState title="Could not load test plans" onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No plans yet" description="Environment matrix plans will appear here." />;
  }

  return (
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
  );
}
