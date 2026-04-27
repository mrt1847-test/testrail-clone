import { Link } from "react-router-dom";

import type { ProjectOverviewDto } from "../types";

type RecentRunListProps = {
  projectId: string;
  runs: ProjectOverviewDto["recentRuns"];
};

export function RecentRunList({ projectId, runs }: RecentRunListProps) {
  if (runs.length === 0) {
    return <p className="text-sm text-slate-500">No recent runs.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {runs.map((run) => (
        <li key={run.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
          <div>
            <Link
              to={`/projects/${projectId}/runs/${run.id}`}
              className="font-medium text-slate-900 hover:underline"
            >
              {run.name}
            </Link>
            <p className="text-xs text-slate-500">
              {run.status} · {run.progress}% · {run.createdAt}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
