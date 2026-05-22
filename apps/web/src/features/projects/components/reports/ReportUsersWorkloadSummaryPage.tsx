import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchUsersWorkloadSummary } from "../../api/projectSummaryReportsApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportFilterBar,
  ReportPageHeader,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";
import { ReportToolbar } from "./ReportToolbar";

export function ReportUsersWorkloadSummaryPage() {
  const { projectId = "" } = useParams();
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: reportKeys.usersWorkloadSummary(projectId),
    queryFn: () => fetchUsersWorkloadSummary(projectId),
    enabled: Boolean(projectId)
  });

  const report = q.data;
  const rows = useMemo(() => {
    const items = report?.items ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        row.userId.includes(needle)
    );
  }, [report?.items, search]);

  const summaryItems = useMemo(() => {
    if (!report) return [];
    return [
      { label: "Assignees", value: report.totalAssignees, tone: "neutral" as const },
      { label: "Assigned tests", value: report.totalAssignedTests, tone: "violet" as const },
      { label: "Active tests", value: report.totalActiveTests, tone: "amber" as const },
      { label: "Unassigned active", value: report.unassignedActiveCount, tone: "rose" as const }
    ];
  }, [report]);

  if (q.isLoading) return <LoadingState message="Loading users workload summary..." />;
  if (q.isError) {
    return <ErrorState title="Could not load users workload summary" onRetry={() => void q.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Users workload summary"
        description="Assigned test execution load per user, including active counts and assignment aging signals."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "search",
            id: "q",
            label: "Search",
            value: search,
            onChange: setSearch,
            placeholder: "Name or email..."
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      <ReportTablePanel
        title="Team workload"
        toolbar={
          <ReportToolbar
            projectId={projectId}
            reportType="users_workload_summary"
            filters={{ ui: {}, export: {} }}
            disabled={rows.length === 0}
            extra={
              <Link
                className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                to={`/projects/${projectId}/team-todo`}
              >
                Open team to-do
              </Link>
            }
          />
        }
      >
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No assignees match the current filters.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">User</th>
                  <th className="py-2 pr-2">Assigned</th>
                  <th className="py-2 pr-2">Active</th>
                  <th className="py-2 pr-2">Failed</th>
                  <th className="py-2 pr-2">Untested</th>
                  <th className="py-2 pr-2">Overdue</th>
                  <th className="py-2 pr-2">Due soon</th>
                  <th className="py-2">Stale</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.email || row.userId}</div>
                    </td>
                    <td className="py-2 pr-2">{row.assignedCount}</td>
                    <td className="py-2 pr-2">{row.activeCount}</td>
                    <td className="py-2 pr-2">{row.failedCount}</td>
                    <td className="py-2 pr-2">{row.untestedCount}</td>
                    <td className="py-2 pr-2">{row.overdueCount}</td>
                    <td className="py-2 pr-2">{row.dueSoonCount}</td>
                    <td className="py-2">{row.staleCount}</td>
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
