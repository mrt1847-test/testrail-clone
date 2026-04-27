import type { ProjectOverviewDto } from "../types";

type RecentResultListProps = {
  rows: ProjectOverviewDto["recentResults"];
};

export function RecentResultList({ rows }: RecentResultListProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No recent results.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {rows.map((r, i) => (
        <li key={`${r.caseCode}-${i}`} className="flex items-center justify-between px-4 py-2 text-sm">
          <span className="font-mono text-xs text-slate-700">{r.caseCode}</span>
          <span className="text-slate-800">{r.status}</span>
          <span className="text-xs text-slate-500">{r.source}</span>
          <span className="text-xs text-slate-400">{r.at}</span>
        </li>
      ))}
    </ul>
  );
}
