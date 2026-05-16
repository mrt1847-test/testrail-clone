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

type PlanSummaryRow = {
  planId: string;
  name: string;
  status: string;
  entryCount: number;
  runCount: number;
  openRunCount: number;
  total: number;
  passed: number;
  failed: number;
  progress: number;
};

export function ReportPlanSummaryPage() {
  const { projectId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const q = useQuery({
    queryKey: reportKeys.planSummary(projectId),
    queryFn: async (): Promise<PlanSummaryRow[]> => {
      const res = await apiFetch<Ok<{ items: PlanSummaryRow[] }>>(
        `/api/projects/${projectId}/reports/plan-summary`
      );
      return res.data.items ?? [];
    },
    enabled: Boolean(projectId)
  });

  const rows = q.data ?? [];
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "open" && row.status !== "open") return false;
      if (statusFilter === "closed" && row.status !== "closed") return false;
      if (statusFilter === "with_runs" && row.runCount === 0) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle);
    });
  }, [rows, search, statusFilter]);

  const summaryItems = useMemo(() => {
    if (filteredRows.length === 0) return [];
    const entries = filteredRows.reduce((acc, row) => acc + row.entryCount, 0);
    const runs = filteredRows.reduce((acc, row) => acc + row.runCount, 0);
    const total = filteredRows.reduce((acc, row) => acc + row.total, 0);
    const passed = filteredRows.reduce((acc, row) => acc + row.passed, 0);
    const failed = filteredRows.reduce((acc, row) => acc + row.failed, 0);
    return [
      { label: "Plans", value: filteredRows.length, tone: "neutral" as const },
      { label: "Entries", value: entries, tone: "violet" as const },
      { label: "Runs", value: runs, tone: "neutral" as const },
      { label: "Tests", value: total, tone: "neutral" as const },
      { label: "Passed", value: passed, tone: "emerald" as const },
      { label: "Failed", value: failed, tone: "rose" as const }
    ];
  }, [filteredRows]);

  if (q.isLoading) return <LoadingState message="Loading plan summary..." />;
  if (q.isError) return <ErrorState title="Could not load plan summary" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Plan summary"
        description="Test plans rolled up across entries, generated runs, and execution results."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: "Plan name..."
          },
          {
            kind: "select",
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All plans" },
              { value: "open", label: "Open only" },
              { value: "closed", label: "Closed only" },
              { value: "with_runs", label: "With runs" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Plans"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton
              projectId={projectId}
              reportType="plan_summary"
              filters={{ ui: { search, status: statusFilter } }}
            />
            <ReportExportButton projectId={projectId} reportType="plan_summary" disabled={rows.length === 0} />
          </div>
        }
      >
        {filteredRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {rows.length === 0 ? "No plans." : "No plans match the current filters."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Plan</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Entries</th>
                  <th className="py-2 pr-2">Runs</th>
                  <th className="py-2 pr-2">Progress</th>
                  <th className="py-2 pr-2">Passed</th>
                  <th className="py-2 pr-2">Failed</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.planId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <Link className="font-medium text-indigo-800 hover:underline" to={`/projects/${projectId}/plans/${row.planId}`}>
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-slate-700">{row.status}</td>
                    <td className="py-2 pr-2">{row.entryCount}</td>
                    <td className="py-2 pr-2">
                      {row.runCount}
                      {row.openRunCount > 0 ? <span className="ml-1 text-xs text-slate-500">({row.openRunCount} open)</span> : null}
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
