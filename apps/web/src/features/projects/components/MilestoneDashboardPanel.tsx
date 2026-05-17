import { Link } from "react-router-dom";

import type { MilestoneDashboard, MilestoneSummaryRow } from "../api/milestoneSummaryApi";
import { MilestoneLifecycleBadge } from "./MilestoneLifecycleBadge";
import { MilestoneProgressChip } from "./MilestoneProgressChip";

type MilestoneDashboardPanelProps = {
  projectId: string;
  dashboard: MilestoneDashboard;
  itemsById?: Map<string, MilestoneSummaryRow>;
  compact?: boolean;
};

export function MilestoneDashboardPanel({
  projectId,
  dashboard,
  itemsById,
  compact = false
}: MilestoneDashboardPanelProps) {
  const summaryChips = [
    { label: "Milestones", value: dashboard.milestoneCount },
    { label: "Open", value: dashboard.openCount },
    { label: "Upcoming", value: dashboard.upcomingCount },
    { label: "With sub-milestones", value: dashboard.withSubMilestonesCount }
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={`font-semibold text-slate-900 ${compact ? "text-sm" : "text-base"}`}>Milestone progress</h3>
          <p className="text-xs text-slate-500">Top-level milestones with sub-milestone rollups</p>
        </div>
        <Link to={`/projects/${projectId}/milestones`} className="text-xs font-medium text-indigo-800 hover:underline">
          All milestones
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {summaryChips.map((chip) => (
          <span
            key={chip.label}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
          >
            <span className="font-medium text-slate-900">{chip.value}</span>
            <span>{chip.label}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs text-violet-900">
          <span className="font-medium">{dashboard.progress}%</span>
          <span>rolled up</span>
        </span>
      </div>

      {dashboard.topMilestones.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No top-level milestones yet.</p>
      ) : (
        <ul className={`mt-3 space-y-2 ${compact ? "text-xs" : "text-sm"}`}>
          {dashboard.topMilestones.map((row) => {
            const detail = itemsById?.get(row.milestoneId);
            return (
              <li
                key={row.milestoneId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 px-3 py-2"
              >
                <Link
                  to={`/projects/${projectId}/milestones/${row.milestoneId}`}
                  className={`min-w-0 font-medium text-indigo-800 hover:underline ${compact ? "text-xs" : "text-sm"}`}
                >
                  {row.name}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <MilestoneLifecycleBadge status={row.lifecycleStatus} />
                  <MilestoneProgressChip
                    progress={detail?.progress ?? row.progress}
                    runCount={detail?.runCount ?? row.runCount}
                    childCount={row.childCount}
                    includesSubMilestones={detail?.includesSubMilestones ?? row.includesSubMilestones}
                    compact={compact}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
