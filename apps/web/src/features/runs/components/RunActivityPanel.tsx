import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  getActivityCompositionCaseLinks,
  getActivityPrimaryHref
} from "../../../shared/activity/activityLinks";
import { fetchProjectActivity } from "../../projects/api/settingsApi";

type Props = {
  projectId: string;
  runId: string;
};

export function RunActivityPanel({ projectId, runId }: Props) {
  const [page, setPage] = useState(1);
  const activityQuery = useQuery({
    queryKey: ["project-activity", projectId, "run", runId, page],
    queryFn: () => fetchProjectActivity(projectId, page, 15, { runId }),
    enabled: Boolean(projectId && runId)
  });

  if (activityQuery.isLoading) {
    return <p className="px-3 py-4 text-sm text-slate-500">Loading activity…</p>;
  }
  if (activityQuery.isError) {
    return (
      <div className="px-3 py-4">
        <p className="text-sm text-red-700">Could not load activity.</p>
        <button
          type="button"
          className="mt-2 text-xs font-medium text-slate-700 underline"
          onClick={() => void activityQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  const rows = activityQuery.data?.data ?? [];

  if (rows.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-slate-500">
        <p>No run activity yet.</p>
        <Link to={`/projects/${projectId}/activity`} className="mt-2 inline-block text-xs font-medium text-indigo-800 underline">
          View all project activity
        </Link>
      </div>
    );
  }

  return (
    <div className="flex max-h-[min(28rem,50vh)] flex-col">
      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto px-1 py-1">
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
            <li key={row.id} className="px-2 py-2.5">
              <p className="text-sm font-medium text-slate-900">{row.title}</p>
              {row.body ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{row.body}</p> : null}
              <p className="mt-1 text-[11px] text-slate-500">{new Date(row.createdAt).toLocaleString()}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                {primaryHref ? (
                  <Link to={primaryHref} className="text-[11px] font-medium text-indigo-800 underline">
                    Open
                  </Link>
                ) : null}
                {caseLinks.map((link) => (
                  <Link key={link.caseId} to={link.href} className="text-[11px] text-slate-600 underline">
                    {link.label}
                  </Link>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[11px]">
        <span className="text-slate-500">
          {activityQuery.data?.page ?? 1} / {activityQuery.data?.totalPages ?? 1}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded border border-slate-200 px-2 py-0.5 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= (activityQuery.data?.totalPages ?? 1)}
            onClick={() => setPage((current) => current + 1)}
            className="rounded border border-slate-200 px-2 py-0.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
      <div className="border-t border-slate-100 px-3 py-2">
        <Link to={`/projects/${projectId}/activity`} className="text-xs font-medium text-indigo-800 underline">
          All project activity
        </Link>
      </div>
    </div>
  );
}






