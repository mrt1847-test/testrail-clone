import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchProjectExecutionSummary } from "../../api/projectSummaryReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportActions,
  ReportFilterBar,
  ReportPageHeader,
  ReportSaveViewButton,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

export function ReportProjectSummaryPage() {
  const { projectId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const q = useQuery({
    queryKey: reportKeys.projectSummary(projectId),
    queryFn: () => fetchProjectExecutionSummary(projectId),
    enabled: Boolean(projectId)
  });

  const report = q.data;
  const rows = useMemo(() => {
    const items = report?.runs ?? [];
    const needle = search.trim().toLowerCase();
    return items.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle);
    });
  }, [report?.runs, search, statusFilter]);

  const summaryItems = useMemo(() => {
    if (!report) return [];
    return [
      { label: "Cases", value: report.totalCases, tone: "neutral" as const },
      { label: "Runs", value: report.totalRuns, tone: "violet" as const },
      { label: "Active runs", value: report.activeRuns, tone: "amber" as const },
      { label: "Tests executed", value: report.execution.total, tone: "emerald" as const },
      { label: "Progress", value: `${report.execution.progress}%`, tone: "rose" as const }
    ];
  }, [report]);

  if (q.isLoading) return <LoadingState message="Loading project summary..." />;
  if (q.isError) return <ErrorState title="Could not load project summary" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Project summary"
        description="Cross-run execution rollup for this project, including overall status distribution."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search runs",
            value: search,
            onChange: setSearch,
            placeholder: "Run name..."
          },
          {
            kind: "select",
            id: "status",
            label: "Run status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All runs" },
              { value: "open", label: "Open" },
              { value: "completed", label: "Completed" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      {report ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <p>
            Automation coverage: <span className="font-medium">{report.automationCoveragePct}%</span> · Passed{" "}
            <span className="font-medium">{report.execution.passed}</span> · Failed{" "}
            <span className="font-medium">{report.execution.failed}</span> · Blocked{" "}
            <span className="font-medium">{report.execution.blocked}</span> · Untested{" "}
            <span className="font-medium">{report.execution.untested}</span>
          </p>
        </div>
      ) : null}
      <ReportTablePanel
        title="Runs"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton projectId={projectId} reportType="project_summary" />
            <ReportExportActions projectId={projectId} reportType="project_summary" disabled={rows.length === 0} />
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No runs match the current filters.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Run</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Tests</th>
                  <th className="py-2 pr-2">Passed</th>
                  <th className="py-2 pr-2">Failed</th>
                  <th className="py-2">Progress</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.runId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <Link
                        className="font-medium text-indigo-800 hover:underline"
                        to={`/projects/${projectId}/runs/${row.runId}`}
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 capitalize">{row.status}</td>
                    <td className="py-2 pr-2">{row.total}</td>
                    <td className="py-2 pr-2">{row.passed}</td>
                    <td className="py-2 pr-2">{row.failed}</td>
                    <td className="py-2">{row.progress}%</td>
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
