import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";
import { fetchMilestone, fetchMilestoneRuns } from "../api/advancedApi";
import { reportKeys } from "../hooks/reportKeys";
import { ExecutionSummaryChart } from "./ExecutionSummaryChart";
import { ReportSummaryStrip } from "./reports/ReportChrome";
import type { MilestoneSummaryRow } from "./reports/ReportMilestoneSummaryPage";

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
  const summaryQuery = useQuery({
    queryKey: reportKeys.milestoneSummary(projectId),
    queryFn: async () => {
      const res = await apiFetch<Ok<{ items: MilestoneSummaryRow[] }>>(
        `/api/projects/${projectId}/reports/milestone-summary`
      );
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId)
  });

  const rollup = useMemo(
    () => summaryQuery.data?.find((row) => row.milestoneId === milestoneId) ?? null,
    [summaryQuery.data, milestoneId]
  );

  const execution = useMemo(() => {
    if (!rollup) return { total: 0, passed: 0, failed: 0, remaining: 0 };
    const remaining = Math.max(0, rollup.total - rollup.passed - rollup.failed);
    return { total: rollup.total, passed: rollup.passed, failed: rollup.failed, remaining };
  }, [rollup]);

  const summaryItems = useMemo(() => {
    if (!rollup) return [];
    return [
      { label: "Linked runs", value: rollup.runCount, tone: "neutral" as const },
      { label: "Open runs", value: rollup.openRunCount, tone: "amber" as const },
      { label: "Progress", value: `${rollup.progress}%`, tone: "violet" as const },
      { label: "Passed", value: rollup.passed, tone: "emerald" as const },
      { label: "Failed", value: rollup.failed, tone: "rose" as const }
    ];
  }, [rollup]);

  if (milestoneQuery.isLoading || runsQuery.isLoading) return <LoadingState message="Loading milestone detail…" />;
  if (milestoneQuery.isError || runsQuery.isError || !milestoneQuery.data) {
    return (
      <ErrorState
        title="Could not load milestone detail"
        onRetry={() => void Promise.all([milestoneQuery.refetch(), runsQuery.refetch(), summaryQuery.refetch()])}
      />
    );
  }

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Milestone</p>
            <h2 className="text-xl font-semibold text-slate-900">{milestoneQuery.data.name}</h2>
            <p className="text-sm text-slate-600">{milestoneQuery.data.isCompleted ? "completed" : "open"}</p>
          </div>
          <Link
            to={`/projects/${projectId}/reports/milestones`}
            className="text-sm font-medium text-slate-700 underline"
          >
            Milestone summary report
          </Link>
        </div>
      </header>

      {rollup ? (
        <>
          <ReportSummaryStrip items={summaryItems} />
          <ExecutionSummaryChart projectId={projectId} execution={execution} />
        </>
      ) : null}

      {runsQuery.data && runsQuery.data.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Linked runs</h3>
          <ul className="mt-3 space-y-2">
            {runsQuery.data.map((run) => (
              <li key={run.runId} className="rounded border border-slate-200 px-3 py-2 text-sm">
                <Link to={`/projects/${projectId}/runs/${run.runId}`} className="font-medium text-slate-800 underline">
                  {run.runName}
                </Link>
                <span className="ml-2 text-xs text-slate-500">
                  {run.status} · {run.progress}%
                </span>
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
