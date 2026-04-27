import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchMilestone, fetchMilestoneRuns } from "../api/advancedApi";

export function MilestoneDetailPage() {
  const { projectId = "", milestoneId = "" } = useParams();
  const milestoneQuery = useQuery({
    queryKey: ["milestone", projectId, milestoneId],
    queryFn: () => fetchMilestone(projectId, milestoneId),
    enabled: Boolean(projectId && milestoneId)
  });
  const runsQuery = useQuery({
    queryKey: ["milestone-runs", projectId, milestoneId],
    queryFn: () => fetchMilestoneRuns(projectId, milestoneId),
    enabled: Boolean(projectId && milestoneId)
  });

  if (milestoneQuery.isLoading || runsQuery.isLoading) return <LoadingState message="Loading milestone detail…" />;
  if (milestoneQuery.isError || runsQuery.isError || !milestoneQuery.data) {
    return <ErrorState title="Could not load milestone detail" onRetry={() => void Promise.all([milestoneQuery.refetch(), runsQuery.refetch()])} />;
  }

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Milestone</p>
        <h2 className="text-xl font-semibold text-slate-900">{milestoneQuery.data.name}</h2>
        <p className="text-sm text-slate-600">{milestoneQuery.data.isCompleted ? "completed" : "open"}</p>
      </header>

      {runsQuery.data && runsQuery.data.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Linked Runs</h3>
          <ul className="mt-3 space-y-2">
            {runsQuery.data.map((run) => (
              <li key={run.runId} className="rounded border border-slate-200 px-3 py-2 text-sm">
                <Link to={`/projects/${projectId}/runs/${run.runId}`} className="font-medium text-slate-800 underline">
                  {run.runName}
                </Link>
                <span className="ml-2 text-xs text-slate-500">{run.status} · {run.progress}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState title="No linked runs" description="Runs connected to this milestone will appear here." />
      )}
    </div>
  );
}
