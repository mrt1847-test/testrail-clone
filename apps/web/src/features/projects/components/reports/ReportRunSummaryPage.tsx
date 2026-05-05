import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { apiFetch } from "../../../../shared/api/http";
import type { Ok } from "../../../../shared/api/types";
import { reportKeys } from "../../hooks/reportKeys";

type RunSummary = Array<{ runId: string; name: string; status: string; total: number; passed: number; failed: number; progress: number }>;

export function ReportRunSummaryPage() {
  const { projectId = "" } = useParams();
  const q = useQuery({
    queryKey: reportKeys.runSummary(projectId),
    queryFn: async (): Promise<RunSummary> => {
      const res = await apiFetch<Ok<{ items: RunSummary }>>(`/api/projects/${projectId}/reports/run-summary`);
      return res.data.items;
    },
    enabled: Boolean(projectId)
  });

  if (q.isLoading) return <LoadingState message="Loading run summary…" />;
  if (q.isError) return <ErrorState title="Could not load run summary" onRetry={() => void q.refetch()} />;

  const rows = q.data ?? [];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Run summary</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No runs.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-2">Run</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Progress</th>
                <th className="py-2 pr-2">Passed</th>
                <th className="py-2 pr-2">Failed</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.runId} className="border-b border-slate-100">
                  <td className="py-2 pr-2">
                    <Link className="text-indigo-800 hover:underline" to={`/projects/${projectId}/runs/${row.runId}`}>
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 text-slate-700">{row.status}</td>
                  <td className="py-2 pr-2">{row.progress}%</td>
                  <td className="py-2 pr-2">{row.passed}</td>
                  <td className="py-2 pr-2">{row.failed}</td>
                  <td className="py-2">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
