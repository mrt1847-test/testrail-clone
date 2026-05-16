import { Link } from "react-router-dom";

import type { ProjectOverviewDto } from "../types";

type ProjectSummaryCardsProps = {
  projectId: string;
  stats: ProjectOverviewDto["stats"];
};

export function ProjectSummaryCards({ projectId, stats }: ProjectSummaryCardsProps) {
  const base = `/projects/${projectId}`;
  const items = [
    { label: "Cases", value: stats.totalCases, to: `${base}/cases` },
    { label: "Active runs", value: stats.activeRuns, to: `${base}/runs` },
    { label: "Failures", value: stats.recentFailures, to: `${base}/reports` },
    { label: "Automation", value: `${stats.automationCoveragePct}%`, to: `${base}/automation` }
  ];

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {items.map((item) => (
        <Link key={item.label} to={item.to} className="group">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</span>
          <p className="text-lg font-semibold tabular-nums text-slate-900 group-hover:underline">{item.value}</p>
        </Link>
      ))}
    </div>
  );
}
