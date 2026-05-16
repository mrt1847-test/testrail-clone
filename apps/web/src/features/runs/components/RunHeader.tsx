import type { RunDetailDto } from "../types";
import { RunSummaryBar } from "./RunSummaryBar";

type Props = {
  run: RunDetailDto["run"];
  milestoneName?: string;
  counts?: RunDetailDto["counts"];
};

export function RunHeader({ run, milestoneName, counts }: Props) {
  const isOpen = run.status === "open";
  const meta: string[] = [];
  if (run.environment) meta.push(run.environment);
  if (run.milestoneId) meta.push(milestoneName ?? `Milestone #${run.milestoneId}`);
  meta.push(run.assignedTo?.trim() ? run.assignedTo : "Unassigned");
  if (run.startedAt) {
    meta.push(`Started ${new Date(run.startedAt).toLocaleDateString()}`);
  }
  if (run.closedAt) {
    meta.push(`Closed ${new Date(run.closedAt).toLocaleDateString()}`);
  }

  return (
    <header className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-slate-900">{run.name}</h2>
          {meta.length > 0 ? <p className="mt-0.5 truncate text-xs text-slate-500">{meta.join(" · ")}</p> : null}
        </div>
        <span
          className={
            isOpen
              ? "shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-800"
              : "shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700"
          }
        >
          {run.status}
        </span>
      </div>
      {counts ? (
        <div className="mt-2 hidden lg:block">
          <RunSummaryBar counts={counts} mode="compact" />
        </div>
      ) : null}
    </header>
  );
}
