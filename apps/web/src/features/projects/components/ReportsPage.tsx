import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";
import { reportKeys } from "../hooks/reportKeys";

type StatusDistribution = Record<string, number>;
type FailureTrend = Array<{ date: string; failed: number }>;
type RunSummary = Array<{ runId: string; name: string; status: string; total: number; passed: number; failed: number; progress: number }>;

export function ReportsPage() {
  const { projectId = "" } = useParams();
  const statusDistributionQuery = useQuery({
    queryKey: reportKeys.statusDistribution(projectId),
    queryFn: async (): Promise<StatusDistribution> => {
      const res = await apiFetch<Ok<StatusDistribution>>(
        `/api/projects/${projectId}/reports/status-distribution`
      );
      return res.data;
    },
    enabled: Boolean(projectId)
  });

  const failureTrendQuery = useQuery({
    queryKey: reportKeys.failureTrend(projectId),
    queryFn: async (): Promise<FailureTrend> => {
      const res = await apiFetch<Ok<{ points: FailureTrend }>>(
        `/api/projects/${projectId}/reports/failure-trend`
      );
      return res.data.points;
    },
    enabled: Boolean(projectId)
  });

  const runSummaryQuery = useQuery({
    queryKey: reportKeys.runSummary(projectId),
    queryFn: async (): Promise<RunSummary> => {
      const res = await apiFetch<Ok<{ items: RunSummary }>>(
        `/api/projects/${projectId}/reports/run-summary`
      );
      return res.data.items;
    },
    enabled: Boolean(projectId)
  });

  const statusDistribution = statusDistributionQuery.data;
  const failureTrend = failureTrendQuery.data;
  const runSummary = runSummaryQuery.data;
  const totalDistribution = Object.values(statusDistribution ?? {}).reduce((acc, value) => acc + value, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Status Distribution</h2>
        {statusDistributionQuery.isLoading ? (
          <LoadingState message="Loading status distribution…" />
        ) : statusDistributionQuery.isError ? (
          <ErrorState
            title="Could not load status distribution"
            onRetry={() => void statusDistributionQuery.refetch()}
          />
        ) : totalDistribution === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No status data yet.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {Object.entries(statusDistribution ?? {}).map(([status, count]) => (
              <div key={status} className="rounded border border-slate-200 p-2 text-center">
                <p className="text-xs text-slate-500">{status}</p>
                <p className="text-lg font-semibold text-slate-900">{count}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Failure Trend</h2>
        {failureTrendQuery.isLoading ? (
          <LoadingState message="Loading failure trend…" />
        ) : failureTrendQuery.isError ? (
          <ErrorState
            title="Could not load failure trend"
            onRetry={() => void failureTrendQuery.refetch()}
          />
        ) : (failureTrend ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No trend data.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(failureTrend ?? []).map((point) => (
              <li key={point.date} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                <span>{point.date}</span>
                <span className="font-medium text-slate-800">{point.failed}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Run Summary</h2>
        {runSummaryQuery.isLoading ? (
          <LoadingState message="Loading run summary…" />
        ) : runSummaryQuery.isError ? (
          <ErrorState
            title="Could not load run summary"
            onRetry={() => void runSummaryQuery.refetch()}
          />
        ) : (runSummary ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No runs available.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {(runSummary ?? []).map((row) => (
              <li key={String(row.runId)} className="rounded border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-500">
                  {row.status} · progress {row.progress}% · passed {row.passed} · failed {row.failed} / total {row.total}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
