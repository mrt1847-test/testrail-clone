import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { StatusBadge } from "../../../../shared/ui/StatusBadge";
import { fetchStatusTops } from "../../api/casePropertyReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportActions,
  ReportPageHeader,
  ReportSaveViewButton,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

export function ReportStatusTopsPage() {
  const { projectId = "" } = useParams();
  const q = useQuery({
    queryKey: reportKeys.statusTops(projectId),
    queryFn: () => fetchStatusTops(projectId),
    enabled: Boolean(projectId)
  });

  const report = q.data;
  const rows = report?.items ?? [];
  const summaryItems = useMemo(
    () => [
      { label: "Tests", value: report?.totalTests ?? 0, tone: "neutral" as const },
      { label: "Statuses", value: rows.length, tone: "violet" as const },
      { label: "Top count", value: rows[0]?.count ?? 0, tone: "amber" as const }
    ],
    [report?.totalTests, rows]
  );

  if (q.isLoading) return <LoadingState message="Loading status tops..." />;
  if (q.isError) return <ErrorState title="Could not load status tops" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Status tops"
        description="Rank current run test statuses across the project."
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Top statuses"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton projectId={projectId} reportType="status_tops" filters={{}} />
            <ReportExportActions projectId={projectId} reportType="status_tops" disabled={rows.length === 0} />
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No run tests found.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Tests</th>
                  <th className="py-2">Share</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.status} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-2 pr-2 text-slate-700">{row.count}</td>
                    <td className="py-2 text-slate-700">{row.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportTablePanel>
    </div>
  );
}
