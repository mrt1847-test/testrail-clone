import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ExecutionSummaryChart } from "./ExecutionSummaryChart";
import { ProjectSummaryCards } from "./ProjectSummaryCards";
import { RecentFailureTable } from "./RecentFailureTable";
import { RecentRunList } from "./RecentRunList";
import { useProjectOverviewQuery } from "../hooks/useProjectsApi";

const MAX_RECENT_RUNS = 5;

export function ProjectOverviewPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useProjectOverviewQuery(projectId);
  const [activityTab, setActivityTab] = useState<"runs" | "failures">("runs");

  if (isLoading) return <LoadingState message="Loading overview…" />;
  if (isError || !data)
    return <ErrorState title="Could not load overview" onRetry={() => refetch()} />;

  const recentRuns = data.recentRuns.slice(0, MAX_RECENT_RUNS);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <ProjectSummaryCards projectId={projectId} stats={data.stats} />
        <div className="mt-4">
          <ExecutionSummaryChart projectId={projectId} execution={data.execution} compact />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActivityTab("runs")}
              className={
                activityTab === "runs"
                  ? "rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                  : "rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              }
            >
              Recent runs
            </button>
            <button
              type="button"
              onClick={() => setActivityTab("failures")}
              className={
                activityTab === "failures"
                  ? "rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                  : "rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              }
            >
              Recent failures
            </button>
          </div>
          <Link
            to={
              activityTab === "runs"
                ? `/projects/${projectId}/runs`
                : `/projects/${projectId}/reports`
            }
            className="text-xs font-medium text-slate-700 hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="p-3">
          {activityTab === "runs" ? (
            <RecentRunList projectId={projectId} runs={recentRuns} />
          ) : (
            <RecentFailureTable projectId={projectId} rows={data.recentFailures} />
          )}
        </div>
      </section>
    </div>
  );
}
