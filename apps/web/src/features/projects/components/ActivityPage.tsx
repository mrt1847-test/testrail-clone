import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchProjectActivity } from "../api/advancedApi";

function getActivityHref(
  projectId: string,
  row: {
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown> | null;
  }
) {
  const payload = row.payload ?? {};
  const asString = (value: unknown) => (typeof value === "string" ? value : null);
  const runId = asString(payload.runId);
  const testId = asString(payload.testId);
  const caseId = asString(payload.caseId);
  const reportType = asString(payload.reportType);

  if (testId && runId) return `/projects/${projectId}/runs/${runId}?testId=${encodeURIComponent(testId)}`;
  if (runId) return `/projects/${projectId}/runs/${runId}`;
  if (caseId) return `/projects/${projectId}/cases?caseId=${encodeURIComponent(caseId)}`;
  if (row.entityType === "run") return `/projects/${projectId}/runs/${row.entityId}`;
  if (row.entityType === "case") return `/projects/${projectId}/cases?caseId=${encodeURIComponent(row.entityId)}`;
  if (row.entityType === "report") {
    if (reportType === "run_summary") return `/projects/${projectId}/reports/runs`;
    if (reportType === "traceability") return `/projects/${projectId}/reports/traceability`;
    if (reportType === "coverage_gap") return `/projects/${projectId}/reports/coverage`;
    if (reportType === "defect_coverage") return `/projects/${projectId}/reports/defects`;
    return `/projects/${projectId}/reports/explorer`;
  }
  return null;
}

export function ActivityPage() {
  const { projectId = "" } = useParams();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["project-activity", projectId, page],
    queryFn: () => fetchProjectActivity(projectId, page, 25),
    enabled: Boolean(projectId)
  });

  if (isLoading) return <LoadingState message="Loading activity..." />;
  if (isError) return <ErrorState title="Could not load activity" onRetry={() => refetch()} />;

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Activity</h1>
        <p className="text-sm text-slate-600">Recent project events across cases, runs, results, and defects.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No activity yet" description="Project events will appear here as work happens." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-200">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{row.title}</p>
                    {row.body ? <p className="mt-1 text-sm text-slate-600">{row.body}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">
                      {row.eventType} - {row.entityType}:{row.entityId}
                      {row.actor ? ` - ${row.actor.email}` : ""}
                    </p>
                    {getActivityHref(projectId, row) ? (
                      <Link
                        to={getActivityHref(projectId, row)!}
                        className="mt-1 inline-flex text-xs font-medium text-slate-700 underline"
                      >
                        Open source
                      </Link>
                    ) : null}
                  </div>
                  <time className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</time>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-slate-600">
              Page {data?.page ?? 1} of {data?.totalPages ?? 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
