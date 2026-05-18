import type { RunDetailDto } from "../types";
import { runCompletionPercent, runStatusTotal } from "../utils/runProgressSegments";
import { RunProgressChart } from "./RunProgressChart";
import { RunSummaryBar } from "./RunSummaryBar";

type Props = {
  counts: RunDetailDto["counts"];
  activeStatus: string;
  onStatusClick: (status: string) => void;
};

export function RunProgressPanel({ counts, activeStatus, onStatusClick }: Props) {
  const total = runStatusTotal(counts);
  const percentDone = runCompletionPercent(counts);

  return (
    <div className="space-y-3 p-3">
      <RunProgressChart counts={counts} activeStatus={activeStatus} onStatusClick={onStatusClick} size={112} />
      <p className="text-center text-xs text-slate-500">
        {percentDone}% complete · {total} tests
      </p>
      <RunSummaryBar
        counts={counts}
        activeStatus={activeStatus}
        onStatusClick={onStatusClick}
        className="border-0 p-0 shadow-none"
      />
    </div>
  );
}
