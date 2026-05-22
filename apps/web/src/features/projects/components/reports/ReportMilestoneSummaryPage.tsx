import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchMilestoneSummary, type MilestoneSummaryRow } from "../../api/milestoneSummaryApi";
import { reportKeys } from "../../hooks/reportKeys";
import { orderMilestonesForHierarchy } from "../../utils/milestoneDisplay";
import { MilestoneDashboardPanel } from "../MilestoneDashboardPanel";
import { MilestoneLifecycleBadge } from "../MilestoneLifecycleBadge";
import { MilestoneProgressChip } from "../MilestoneProgressChip";
import { MilestoneScheduleBadge } from "../MilestoneScheduleBadge";
import { buildMilestoneSummaryExportQuery, uiFiltersForReport } from "../../reports/reportExportQuery";
import {
  ReportFilterBar,
  ReportPageHeader,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";
import { ReportToolbar } from "./ReportToolbar";

export type { MilestoneSummaryRow };

export function ReportMilestoneSummaryPage() {
  const { projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all");

  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim().length > 0) next.set("search", search.trim());
    if (statusFilter !== "all") next.set("status", statusFilter);
    setSearchParams(next, { replace: true });
  }, [search, setSearchParams, statusFilter]);

  const q = useQuery({
    queryKey: reportKeys.milestoneSummary(projectId),
    queryFn: () => fetchMilestoneSummary(projectId),
    enabled: Boolean(projectId)
  });

  const rows = q.data?.items ?? [];
  const itemsById = useMemo(() => new Map(rows.map((row) => [row.milestoneId, row])), [rows]);

  const exportQuery = useMemo(
    () => buildMilestoneSummaryExportQuery({ search, status: statusFilter }),
    [search, statusFilter]
  );
  const savedFilters = useMemo(
    () => ({ ui: uiFiltersForReport({ search, status: statusFilter }), export: exportQuery }),
    [exportQuery, search, statusFilter]
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "open" && row.lifecycleStatus !== "open") return false;
      if (statusFilter === "upcoming" && row.lifecycleStatus !== "upcoming") return false;
      if (statusFilter === "completed" && row.lifecycleStatus !== "completed") return false;
      if (statusFilter === "with_runs" && row.runCount === 0) return false;
      if (statusFilter === "with_sub" && row.childCount === 0) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle);
    });
  }, [rows, search, statusFilter]);

  const orderedRows = useMemo(
    () =>
      orderMilestonesForHierarchy(
        filteredRows.map((row) => ({
          id: row.milestoneId,
          name: row.name,
          parentMilestoneId: row.parentMilestoneId
        }))
      ).map((ordered) => {
        const row = itemsById.get(ordered.id);
        return row ? { ...row, depth: ordered.depth } : null;
      }).filter((row): row is MilestoneSummaryRow & { depth: number } => Boolean(row)),
    [filteredRows, itemsById]
  );

  const summaryItems = useMemo(() => {
    const dashboard = q.data?.dashboard;
    if (!dashboard) return [];
    return [
      { label: "Milestones", value: dashboard.milestoneCount, tone: "neutral" as const },
      { label: "Open", value: dashboard.openCount, tone: "amber" as const },
      { label: "Linked runs", value: dashboard.linkedRunCount, tone: "violet" as const },
      { label: "Tests", value: dashboard.totalTests, tone: "neutral" as const },
      { label: "Passed", value: dashboard.passed, tone: "emerald" as const },
      { label: "Failed", value: dashboard.failed, tone: "rose" as const }
    ];
  }, [q.data?.dashboard]);

  if (q.isLoading) return <LoadingState message="Loading milestone summary..." />;
  if (q.isError) return <ErrorState title="Could not load milestone summary" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Milestone summary"
        description="Release milestones rolled up across linked runs, sub-milestones, and test instances."
      />
      {q.data?.dashboard ? (
        <MilestoneDashboardPanel projectId={projectId} dashboard={q.data.dashboard} itemsById={itemsById} />
      ) : null}
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: "Milestone name..."
          },
          {
            kind: "select",
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All milestones" },
              { value: "open", label: "Open" },
              { value: "upcoming", label: "Upcoming" },
              { value: "completed", label: "Completed" },
              { value: "with_runs", label: "With linked runs" },
              { value: "with_sub", label: "With sub-milestones" }
            ]
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Milestones"
        toolbar={
          <ReportToolbar
            projectId={projectId}
            reportType="milestone_summary"
            filters={savedFilters}
            exportQuery={exportQuery}
            disabled={rows.length === 0}
          />
        }
      >
        {orderedRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            {rows.length === 0 ? "No milestones." : "No milestones match the current filters."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">Milestone</th>
                  <th className="py-2 pr-2">State</th>
                  <th className="py-2 pr-2">Schedule</th>
                  <th className="py-2 pr-2">Runs</th>
                  <th className="py-2 pr-2">Progress</th>
                  <th className="py-2 pr-2">Passed</th>
                  <th className="py-2 pr-2">Failed</th>
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((row) => (
                  <tr key={row.milestoneId} className="border-b border-slate-100">
                    <td className="py-2 pr-2" style={{ paddingLeft: `${row.depth * 16 + 8}px` }}>
                      <Link
                        className="font-medium text-indigo-800 hover:underline"
                        to={`/projects/${projectId}/milestones/${row.milestoneId}`}
                      >
                        {row.name}
                      </Link>
                      {row.childCount > 0 ? (
                        <p className="text-xs text-slate-500">{row.childCount} sub-milestone(s)</p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">
                      <MilestoneLifecycleBadge status={row.lifecycleStatus} />
                    </td>
                    <td className="py-2 pr-2">
                      <span title={row.forecast.hint}>
                        <MilestoneScheduleBadge status={row.forecast.scheduleStatus} />
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      {row.runCount}
                      {row.includesSubMilestones && row.directRunCount < row.runCount ? (
                        <span className="ml-1 text-xs text-slate-500">(incl. sub)</span>
                      ) : null}
                      {row.openRunCount > 0 ? (
                        <span className="ml-1 text-xs text-slate-500">({row.openRunCount} open)</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">
                      <MilestoneProgressChip
                        progress={row.progress}
                        runCount={row.runCount}
                        childCount={row.childCount}
                        includesSubMilestones={row.includesSubMilestones}
                        compact
                      />
                    </td>
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
