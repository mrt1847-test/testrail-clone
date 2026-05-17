import type { MilestoneScheduleStatus } from "../api/milestoneSummaryApi";

const styles: Record<MilestoneScheduleStatus, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  on_track: "border-emerald-200 bg-emerald-50 text-emerald-900",
  at_risk: "border-amber-200 bg-amber-50 text-amber-900",
  overdue: "border-rose-200 bg-rose-50 text-rose-900",
  no_schedule: "border-slate-200 bg-slate-50 text-slate-700",
  not_started: "border-slate-200 bg-slate-100 text-slate-600"
};

const labels: Record<MilestoneScheduleStatus, string> = {
  completed: "Completed",
  on_track: "On track",
  at_risk: "At risk",
  overdue: "Overdue",
  no_schedule: "No schedule",
  not_started: "Not started"
};

type MilestoneScheduleBadgeProps = {
  status: MilestoneScheduleStatus;
};

export function MilestoneScheduleBadge({ status }: MilestoneScheduleBadgeProps) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
