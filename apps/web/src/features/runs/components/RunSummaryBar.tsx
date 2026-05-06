import type { RunDetailDto } from "../types";

type Props = {
  counts: RunDetailDto["counts"];
};

export function RunSummaryBar({ counts }: Props) {
  const total =
    counts.passed + counts.failed + counts.blocked + counts.retest + counts.untested;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Progress</p>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-900">Passed {counts.passed}</span>
        <span className="rounded-md bg-red-50 px-2 py-1 font-medium text-red-900">Failed {counts.failed}</span>
        <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-900">Blocked {counts.blocked}</span>
        <span className="rounded-md bg-violet-50 px-2 py-1 font-medium text-violet-900">Retest {counts.retest}</span>
        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-800">Untested {counts.untested}</span>
      </div>
      <p className="text-xs text-slate-500 sm:text-right">
        <span className="font-medium text-slate-600">Tests in run:</span> {total}
      </p>
    </div>
  );
}
