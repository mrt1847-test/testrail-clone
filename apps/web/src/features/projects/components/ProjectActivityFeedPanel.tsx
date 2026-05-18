import { Link } from "react-router-dom";

import type { ActivityEventRow } from "../api/settingsApi";
import type { ProjectOverviewDto } from "../types";

type ProjectActivityFeedPanelProps = {
  projectId: string;
  tab: "history" | "changes";
  onTabChange: (tab: "history" | "changes") => void;
  historyRows: ActivityEventRow[];
  changeRows: ProjectOverviewDto["recentResults"];
  historyHasMore?: boolean;
  historyLoading?: boolean;
  onLoadMoreHistory?: () => void;
};

function eventBadgeClass(entityType: string) {
  if (entityType === "run") return "bg-sky-50 text-sky-800";
  if (entityType === "milestone") return "bg-amber-50 text-amber-900";
  if (entityType === "plan") return "bg-indigo-50 text-indigo-900";
  if (entityType === "case") return "bg-violet-50 text-violet-900";
  return "bg-slate-100 text-slate-700";
}

function formatDayHeader(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function groupHistoryByDay(rows: ActivityEventRow[]) {
  const groups: Array<{ day: string; rows: ActivityEventRow[] }> = [];
  for (const row of rows) {
    const day = row.createdAt.slice(0, 10);
    const bucket = groups.find((group) => group.day === day);
    if (bucket) bucket.rows.push(row);
    else groups.push({ day, rows: [row] });
  }
  return groups;
}

export function ProjectActivityFeedPanel({
  projectId,
  tab,
  onTabChange,
  historyRows,
  changeRows,
  historyHasMore = false,
  historyLoading = false,
  onLoadMoreHistory
}: ProjectActivityFeedPanelProps) {
  const isHistory = tab === "history";
  const empty = isHistory ? historyRows.length === 0 : changeRows.length === 0;
  const historyGroups = groupHistoryByDay(historyRows);

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onTabChange("history")}
            className={
              isHistory
                ? "rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                : "rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            }
          >
            History
          </button>
          <button
            type="button"
            onClick={() => onTabChange("changes")}
            className={
              !isHistory
                ? "rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                : "rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            }
          >
            Test Changes
          </button>
        </div>
        <Link to={`/projects/${projectId}/activity`} className="text-xs font-medium text-indigo-800 hover:underline">
          View all activity
        </Link>
      </div>

      {empty ? (
        <p className="px-4 py-4 text-sm text-slate-500">No recent activity.</p>
      ) : isHistory ? (
        <div className="divide-y divide-slate-200">
          {historyGroups.map((group) => (
            <div key={group.day}>
              <div className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {formatDayHeader(group.day)}
              </div>
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {group.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="w-28 px-4 py-2 align-top">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${eventBadgeClass(row.entityType)}`}>
                          {row.entityType}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <p className="font-medium text-slate-900">{row.title}</p>
                        <p className="text-xs text-slate-500">{row.eventType}</p>
                      </td>
                      <td className="px-4 py-2 text-right align-top text-xs text-slate-500">
                        {new Date(row.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              {changeRows.slice(0, 8).map((row, index) => (
                <tr key={`${row.caseCode}-${index}`}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-700">{row.caseCode}</td>
                  <td className="px-4 py-2">
                    <span className="font-medium capitalize text-slate-900">{row.status}</span>
                    <span className="ml-2 text-xs text-slate-500">{row.source}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-slate-500">{row.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isHistory && historyHasMore ? (
        <div className="border-t border-slate-200 px-4 py-3 text-center">
          <button
            type="button"
            disabled={historyLoading}
            onClick={onLoadMoreHistory}
            className="text-xs font-medium text-indigo-800 hover:underline disabled:opacity-50"
          >
            {historyLoading ? "Loading…" : "Show more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
