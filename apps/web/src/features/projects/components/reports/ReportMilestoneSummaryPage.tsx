import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { apiFetch } from "../../../../shared/api/http";
import type { Ok } from "../../../../shared/api/types";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportButton,
  ReportSaveViewButton,
  ReportFilterBar,
  ReportPageHeader,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

export type MilestoneSummaryRow = {
  milestoneId: string;
  name: string;
  isCompleted: boolean;
  runCount: number;
  openRunCount: number;
  total: number;
  passed: number;
  failed: number;
  progress: number;
};

export function ReportMilestoneSummaryPage() {
  const { projectId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const q = useQuery({
    queryKey: reportKeys.milestoneSummary(projectId),
    queryFn: async (): Promise<MilestoneSummaryRow[]> => {
      const res = await apiFetch<Ok<{ items: MilestoneSummaryRow[] }>>(
        `/api/projects/${projectId}/reports/milestone-summary`
      );
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId)
  });

  const rows = q.data ?? [];

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "open" && row.isCompleted) return false;
      if (statusFilter === "completed" && !row.isCompleted) return false;
      if (statusFilter === "with_runs" && row.runCount === 0) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle);
    });
  }, [rows, search, statusFilter]);

  const summaryItems = useMemo(() => {
    if (filteredRows.length === 0) return [];
    const totalTests = filteredRows.reduce((acc, r) => acc + r.total, 0);
    const totalPassed = filteredRows.reduce((acc, r) => acc + r.passed, 0);
    const totalFailed = filteredRows.reduce((acc, r) => acc + r.failed, 0);
    const openMilestones = filteredRows.filter((r) => !r.isCompleted).length;
    const linkedRuns = filteredRows.reduce((acc, r) => acc + r.runCount, 0);
    return [
      { label: "Milestones", value: filteredRows.length, tone: "neutral" as const },
      { label: "Open", value: openMilestones, tone: "amber" as const },
      { label: "Linked runs", value: linkedRuns, tone: "violet" as const },
      { label: "Tests", value: totalTests, tone: "neutral" as const },
      { label: "Passed", value: totalPassed, tone: "emerald" as const },
      { label: "Failed", value: totalFailed, tone: "rose" as const }
    ];
  }, [filteredRows]);

  if (q.isLoading) return <LoadingState message="Loading milestone summary…" />;
  if (q.isError) return <ErrorState title="Could not load milestone summary" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Milestone summary"
        description="Release milestones rolled up across linked runs and test instances. Open a milestone to review runs or drill into execution."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: "Milestone name…"
          },
          {
            kind: "select",
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All milestones" },
              { value: "open", label: "Open only" },
              { value: "completed", label: "Completed only" },
              { value: "with_runs", label: "With linked runs" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Milestones"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton
              projectId={projectId}
              reportType="milestone_summary"
              filters={{ ui: { search, status: statusFilter } }}
            />
            <ReportExportButton projectId={projectId} reportType="milestone_summary" disabled={rows.length === 0} />
          </div>
        }
      >
        {filteredRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {rows.length === 0 ? "No milestones." : "No milestones match the current filters."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Milestone</th>
                  <th className="py-2 pr-2">State</th>
                  <th className="py-2 pr-2">Runs</th>
                  <th className="py-2 pr-2">Progress</th>
                  <th className="py-2 pr-2">Passed</th>
                  <th className="py-2 pr-2">Failed</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.milestoneId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <Link
                        className="font-medium text-indigo-800 hover:underline"
                        to={`/projects/${projectId}/milestones/${row.milestoneId}`}
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-slate-700">{row.isCompleted ? "completed" : "open"}</td>
                    <td className="py-2 pr-2">
                      {row.runCount}
                      {row.openRunCount > 0 ? (
                        <span className="ml-1 text-xs text-slate-500">({row.openRunCount} open)</span>
                      ) : null}
                    </td>
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
      </ReportTablePanel>
    </div>
  );
}
