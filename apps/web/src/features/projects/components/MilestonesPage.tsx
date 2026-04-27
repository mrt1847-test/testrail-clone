import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchMilestones } from "../api/advancedApi";

export function MilestonesPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId)
  });

  if (isLoading) return <LoadingState message="Loading milestones…" />;
  if (isError) return <ErrorState title="Could not load milestones" onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No milestones yet" description="Milestone list will appear here." />;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Milestones</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-800">
        {data.map((row) => (
          <li key={row.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
            <Link to={`/projects/${projectId}/milestones/${row.id}`} className="underline">
              {row.name}
            </Link>
            <span className="text-xs text-slate-500">{row.isCompleted ? "completed" : "open"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
