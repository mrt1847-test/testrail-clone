import type { ProjectOverviewDto } from "../types";

type ProjectSummaryCardsProps = {
  stats: ProjectOverviewDto["stats"];
};

export function ProjectSummaryCards({ stats }: ProjectSummaryCardsProps) {
  const items = [
    { label: "Total cases", value: stats.totalCases },
    { label: "Active runs", value: stats.activeRuns },
    { label: "Recent failures", value: stats.recentFailures },
    { label: "Automation coverage", value: `${stats.automationCoveragePct}%` },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
