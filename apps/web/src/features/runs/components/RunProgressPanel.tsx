import type { RunDetailDto } from "../types";
import { RunSummaryBar } from "./RunSummaryBar";

type Props = {
  counts: RunDetailDto["counts"];
  activeStatus: string;
  onStatusClick: (status: string) => void;
};

export function RunProgressPanel({ counts, activeStatus, onStatusClick }: Props) {
  const total =
    counts.passed + counts.failed + counts.blocked + counts.retest + counts.untested;
  const executed = counts.passed + counts.failed + counts.blocked + counts.retest;
  const percentDone = total > 0 ? Math.round((executed / total) * 100) : 0;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-md bg-slate-50 px-3 py-2">
        <p className="text-2xl font-semibold tabular-nums text-slate-900">{percentDone}%</p>
        <p className="text-xs text-slate-500">
          {executed} of {total} tests have a result
        </p>
      </div>
      <RunSummaryBar
        counts={counts}
        activeStatus={activeStatus}
        onStatusClick={onStatusClick}
        className="border-0 p-0 shadow-none"
      />
    </div>
  );
}
