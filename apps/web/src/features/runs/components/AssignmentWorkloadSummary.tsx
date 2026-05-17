import { summarizeAssignmentAging, type AssignmentAgingLevel } from "@testrail-clone/shared";

type AssignmentWorkloadSummaryProps = {
  levels: AssignmentAgingLevel[];
};

function SummaryChip({ label, count, tone }: { label: string; count: number; tone: string }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}>
      <span className="tabular-nums">{count}</span>
      {label}
    </span>
  );
}

export function AssignmentWorkloadSummary({ levels }: AssignmentWorkloadSummaryProps) {
  const summary = summarizeAssignmentAging(levels);
  if (summary.overdue === 0 && summary.dueSoon === 0 && summary.stale === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" role="status" aria-label="Assignment aging summary">
      <SummaryChip label="overdue" count={summary.overdue} tone="bg-rose-50 text-rose-800 ring-rose-200" />
      <SummaryChip label="due soon" count={summary.dueSoon} tone="bg-amber-50 text-amber-900 ring-amber-200" />
      <SummaryChip label="stale" count={summary.stale} tone="bg-slate-100 text-slate-700 ring-slate-200" />
    </div>
  );
}
