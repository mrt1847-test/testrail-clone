import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

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

type RunSummary = Array<{ runId: string; name: string; status: string; total: number; passed: number; failed: number; progress: number }>;

export function ReportRunSummaryPage() {
  const { projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all");

  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim().length > 0) next.set("search", search.trim());
    if (statusFilter !== "all") next.set("status", statusFilter);
    setSearchParams(next, { replace: true });
  }, [search, setSearchParams, statusFilter]);

  const q = useQuery({
    queryKey: reportKeys.runSummary(projectId),
    queryFn: async (): Promise<RunSummary> => {
      const res = await apiFetch<Ok<{ items: RunSummary }>>(`/api/projects/${projectId}/reports/run-summary`);
      return res.data.items;
    },
    enabled: Boolean(projectId)
  });

  const rows = q.data ?? [];

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle);
    });
  }, [rows, search, statusFilter]);

  const summaryItems = useMemo(() => {
    if (filteredRows.length === 0) return [];
    const totalTests = filteredRows.reduce((acc, r) => acc + r.total, 0);
    const totalPassed = filteredRows.reduce((acc, r) => acc + r.passed, 0);
    const totalFailed = filteredRows.reduce((acc, r) => acc + r.failed, 0);
    const openRuns = filteredRows.filter((r) => r.status === "open").length;
    const avgProgress =
      filteredRows.length > 0
        ? Math.round(filteredRows.reduce((acc, r) => acc + r.progress, 0) / filteredRows.length)
        : 0;
    return [
      { label: "Runs", value: filteredRows.length, tone: "neutral" as const },
      { label: "Open", value: openRuns, tone: "amber" as const },
      { label: "Tests", value: totalTests, tone: "neutral" as const },
      { label: "Passed", value: totalPassed, tone: "emerald" as const },
      { label: "Failed", value: totalFailed, tone: "rose" as const },
      {
        label: "Avg progress",
        value: `${avgProgress}%`,
        tone: "violet" as const,
        hint: "Mean progress across filtered runs"
      }
    ];
  }, [filteredRows]);

  if (q.isLoading) return <LoadingState message="Loading run summary…" />;
  if (q.isError) return <ErrorState title="Could not load run summary" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Run summary"
        description="Progress and outcome totals per test run. Open a run to execute tests or drill into instances."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: "Run name…"
          },
          {
            kind: "select",
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All statuses" },
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Runs"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton
              projectId={projectId}
              reportType="run_summary"
              filters={{ ui: { search, status: statusFilter } }}
            />
            <ReportExportButton projectId={projectId} reportType="run_summary" disabled={rows.length === 0} />
          </div>
        }
      >
        {filteredRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {rows.length === 0 ? "No runs." : "No runs match the current filters."}
          </p>
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
                {filteredRows.map((row) => (
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
      </ReportTablePanel>
    </div>
  );
}
