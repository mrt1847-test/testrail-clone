import { Link } from "react-router-dom";

import type { ProjectOverviewDto } from "../types";

type RecentFailureTableProps = {
  projectId: string;
  rows: ProjectOverviewDto["recentFailures"];
};

export function RecentFailureTable({ projectId, rows }: RecentFailureTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No recent failures.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2">Case</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Run</th>
            <th className="px-3 py-2">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={`${r.runId}-${r.caseCode}-${r.at}`}>
              <td className="px-3 py-2 font-mono text-xs">
                <Link
                  to={`/projects/${projectId}/runs/${r.runId}?status=failed&q=${encodeURIComponent(r.caseCode)}`}
                  className="text-slate-900 hover:underline"
                >
                  {r.caseCode}
                </Link>
              </td>
              <td className="px-3 py-2">{r.title}</td>
              <td className="px-3 py-2">
                <Link
                  to={`/projects/${projectId}/runs/${r.runId}?status=failed`}
                  className="text-slate-700 hover:underline"
                >
                  {r.runName}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-500">{r.at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
