import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { fetchCaseActivitySummary } from "../../api/caseActivitySummaryApi";
import { reportKeys } from "../../hooks/reportKeys";
import {
  ReportExportActions,
  ReportSaveViewButton,
  ReportFilterBar,
  ReportPageHeader,
  ReportSummaryStrip,
  ReportTablePanel
} from "./ReportChrome";

const DAY_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" }
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All activity" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted / archived" },
  { value: "other", label: "Other" }
];

export function ReportCaseActivitySummaryPage() {
  const { projectId = "" } = useParams();
  const [days, setDays] = useState("30");
  const [category, setCategory] = useState("all");

  const query = useMemo(
    () => ({
      days: Number(days) || 30,
      category: category as "created" | "updated" | "deleted" | "other" | "all"
    }),
    [days, category]
  );

  const exportQuery = useMemo(
    () => ({
      days,
      category: category === "all" ? undefined : category
    }),
    [days, category]
  );

  const q = useQuery({
    queryKey: reportKeys.caseActivitySummary(projectId, query),
    queryFn: () => fetchCaseActivitySummary(projectId, query),
    enabled: Boolean(projectId)
  });

  const summary = q.data;
  const recent = summary?.recent ?? [];

  const summaryItems = useMemo(() => {
    if (!summary) return [];
    const created = summary.byCategory.find((row) => row.category === "created")?.count ?? 0;
    const updated = summary.byCategory.find((row) => row.category === "updated")?.count ?? 0;
    const deleted = summary.byCategory.find((row) => row.category === "deleted")?.count ?? 0;
    return [
      { label: "Events", value: summary.totalEvents, tone: "neutral" as const },
      { label: "Unique cases", value: summary.uniqueCaseCount, tone: "violet" as const },
      { label: "Created", value: created, tone: "emerald" as const },
      { label: "Updated", value: updated, tone: "amber" as const },
      { label: "Deleted", value: deleted, tone: "rose" as const }
    ];
  }, [summary]);

  if (q.isLoading) return <LoadingState message="Loading case activity summary…" />;
  if (q.isError) return <ErrorState title="Could not load case activity summary" onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Case activity summary"
        description="Test case create, update, and delete activity from the project activity log."
      />
      <ReportFilterBar
        fields={[
          {
            kind: "select",
            id: "days",
            label: "Window",
            value: days,
            onChange: setDays,
            options: DAY_OPTIONS
          },
          {
            kind: "select",
            id: "category",
            label: "Category",
            value: category,
            onChange: setCategory,
            options: CATEGORY_OPTIONS
          }
        ]}
      />
      <ReportSummaryStrip items={summaryItems} />
      {summary && summary.byDay.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Activity by day</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {summary.byDay.map((row) => (
              <li key={row.date} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2">
                <span className="font-medium text-slate-800">{row.date}</span>
                <span className="text-xs text-slate-500">
                  total {row.total} · created {row.created} · updated {row.updated} · deleted {row.deleted}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ReportTablePanel
        title="Recent activity"
        toolbar={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReportSaveViewButton
              projectId={projectId}
              reportType="case_activity_summary"
              filters={{ ui: { days, category }, export: exportQuery }}
            />
            <ReportExportActions
              projectId={projectId}
              reportType="case_activity_summary"
              disabled={recent.length === 0}
              exportQuery={exportQuery}
            />
          </div>
        }
      >
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No case activity in the selected window.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-2">When</th>
                  <th className="py-2 pr-2">Category</th>
                  <th className="py-2 pr-2">Case</th>
                  <th className="py-2 pr-2">Event</th>
                  <th className="py-2">Actor</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-2 capitalize text-slate-700">{row.category}</td>
                    <td className="py-2 pr-2">
                      <Link
                        className="font-medium text-indigo-800 hover:underline"
                        to={`/projects/${projectId}/cases/${row.caseId}`}
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-xs text-slate-500">{row.eventType}</td>
                    <td className="py-2 text-slate-700">{row.actorName}</td>
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

