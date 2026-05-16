import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import {
  getActivityCompositionCaseLinks,
  getActivityPrimaryHref
} from "../../../shared/activity/activityLinks";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchProjectActivity } from "../api/advancedApi";

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
            {rows.map((row) => {
              const target = {
                entityType: row.entityType,
                entityId: row.entityId,
                eventType: row.eventType,
                payload: row.payload
              };
              const primaryHref = getActivityPrimaryHref(projectId, target);
              const caseLinks = getActivityCompositionCaseLinks(projectId, target);
              return (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{row.title}</p>
                      {row.body ? <p className="mt-1 text-sm text-slate-600">{row.body}</p> : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {row.eventType} - {row.entityType}:{row.entityId}
                        {row.actor ? ` - ${row.actor.email}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {primaryHref ? (
                          <Link to={primaryHref} className="text-xs font-medium text-slate-700 underline">
                            {row.eventType === "run.tests_added" || row.eventType === "run.test_removed"
                              ? "Open run"
                              : "Open source"}
                          </Link>
                        ) : null}
                        {caseLinks.map((link) => (
                          <Link key={link.caseId} to={link.href} className="text-xs text-slate-600 underline">
                            Case {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <time className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</time>
                  </div>
                </li>
              );
            })}
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
