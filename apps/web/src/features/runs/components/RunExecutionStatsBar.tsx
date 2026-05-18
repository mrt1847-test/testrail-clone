import type { RunDetailDto } from "../types";
import { runCompletionPercent, runStatusTotal } from "../utils/runProgressSegments";
import { RunProgressChart } from "./RunProgressChart";
import { RunSummaryBar } from "./RunSummaryBar";

type Props = {
  counts: RunDetailDto["counts"];
  activeStatus: string;
  onStatusClick: (status: string) => void;
  className?: string;
  sticky?: boolean;
};

export function RunExecutionStatsBar({ counts, activeStatus, onStatusClick, className = "", sticky = false }: Props) {
  const total = runStatusTotal(counts);
  const completion = runCompletionPercent(counts);

  return (
    <section
      className={[
        "rounded-lg border border-slate-200 bg-white p-3 shadow-sm",
        sticky ? "sticky top-0 z-20" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Run progress"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <RunProgressChart
          counts={counts}
          activeStatus={activeStatus}
          onStatusClick={onStatusClick}
          className="lg:shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-800">{completion}%</span> complete ·{" "}
            <span className="tabular-nums">{total}</span> tests in run
          </p>
          <RunSummaryBar
            counts={counts}
            activeStatus={activeStatus}
            onStatusClick={onStatusClick}
            mode="compact"
            className="border-0 p-0 shadow-none"
          />
        </div>
      </div>
    </section>
  );
}
