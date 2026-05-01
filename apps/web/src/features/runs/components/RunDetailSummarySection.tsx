import type { RunDetailDto } from "../types";

type Props = {
  run: RunDetailDto["run"];
  counts: RunDetailDto["counts"];
  milestoneName?: string;
};

export function RunDetailSummarySection(props: Props) {
  const { run, counts, milestoneName } = props;

  return (
    <>
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase text-slate-500">Run</p>
        <h2 className="text-xl font-semibold text-slate-900">{run.name}</h2>
        <p className="text-sm text-slate-600">
          {run.status} {run.environment ? `· ${run.environment}` : ""}
        </p>
        {run.milestoneId ? (
          <p className="text-xs text-slate-500">milestone: {milestoneName ?? `#${run.milestoneId}`}</p>
        ) : null}
        <p className="text-xs text-slate-500">assignee: {run.assignedTo ?? "unassigned"}</p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-900">Passed {counts.passed}</span>
        <span className="rounded-md bg-red-50 px-2 py-1 text-red-900">Failed {counts.failed}</span>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">Blocked {counts.blocked}</span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-800">Retest {counts.retest}</span>
        <span className="rounded-md bg-slate-50 px-2 py-1 text-slate-700">Untested {counts.untested}</span>
      </div>
    </>
  );
}
