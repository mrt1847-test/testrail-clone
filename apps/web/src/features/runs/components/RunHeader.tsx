import type { RunDetailDto } from "../types";

type Props = {
  run: RunDetailDto["run"];
  milestoneName?: string;
};

export function RunHeader({ run, milestoneName }: Props) {
  const isOpen = run.status === "open";

  return (
    <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Run</p>
          <h2 className="mt-0.5 truncate text-xl font-semibold text-slate-900">{run.name}</h2>
        </div>
        <span
          className={
            isOpen
              ? "shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800"
              : "shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700"
          }
        >
          {run.status}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {run.environment ? (
          <span>
            <span className="font-medium text-slate-500">Environment:</span> {run.environment}
          </span>
        ) : null}
        {run.milestoneId ? (
          <span>
            <span className="font-medium text-slate-500">Milestone:</span> {milestoneName ?? `#${run.milestoneId}`}
          </span>
        ) : null}
        <span>
          <span className="font-medium text-slate-500">Assignee:</span> {run.assignedTo?.trim() ? run.assignedTo : "Unassigned"}
        </span>
      </div>
    </header>
  );
}
