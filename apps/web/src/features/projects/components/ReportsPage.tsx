import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

type ReportsPayload = {
  statusDistribution: Record<string, number>;
  failureTrend: Array<{ date: string; failed: number }>;
  runSummary: Array<{ runId: string; name: string; status: string; total: number; passed: number; failed: number; progress: number }>;
};

export function ReportsPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reports-dashboard", projectId],
    queryFn: async (): Promise<ReportsPayload> => {
      const [distribution, trend, runSummary] = await Promise.all([
        apiFetch<Ok<Record<string, number>>>(`/api/projects/${projectId}/reports/status-distribution`),
        apiFetch<Ok<{ points: Array<{ date: string; failed: number }> }>>(
          `/api/projects/${projectId}/reports/failure-trend`
        ),
        apiFetch<
          Ok<{
            items: Array<{
              runId: string;
              name: string;
              status: string;
              total: number;
              passed: number;
              failed: number;
              progress: number;
            }>;
          }>
        >(`/api/projects/${projectId}/reports/run-summary`)
      ]);
      return {
        statusDistribution: distribution.data,
        failureTrend: trend.data.points,
        runSummary: runSummary.data.items
      };
    },
    enabled: Boolean(projectId)
  });

  if (isLoading) return <LoadingState message="Loading reports…" />;
  if (isError || !data) return <ErrorState title="Could not load reports" onRetry={() => refetch()} />;
  const totalDistribution = Object.values(data.statusDistribution).reduce((acc, value) => acc + value, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Status Distribution</h2>
        {totalDistribution === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No status data yet.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {Object.entries(data.statusDistribution).map(([status, count]) => (
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
        {data.failureTrend.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No trend data.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.failureTrend.map((point) => (
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
        {data.runSummary.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No runs available.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.runSummary.map((row) => (
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
