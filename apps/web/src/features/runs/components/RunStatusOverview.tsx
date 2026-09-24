import type { RunDetailDto } from "../types";
import { runStatusTotal } from "../utils/runProgressSegments";
import {
  buildRunStatusLegendItems,
  formatRunWidePassedLabel,
  formatRunWideUntestedLabel,
  runStatusFilterHint
} from "../utils/runStatusOverview";
import { RunProgressChart } from "./RunProgressChart";

type Props = {
  counts: RunDetailDto["counts"];
  activeStatus: string;
  onStatusSelect: (status: string) => void;
  visibleCount?: number;
};

export function RunStatusOverview({ counts, activeStatus, onStatusSelect, visibleCount }: Props) {
  const total = runStatusTotal(counts);
  const items = buildRunStatusLegendItems(counts);
  const hint = runStatusFilterHint({ activeStatus, counts, visibleCount });

  return (
    <section className="border-b border-slate-300 px-3 py-1.5 sm:px-4" aria-label="Run-wide status">
      {/* Narrow widths use two legend columns and wrapping labels so status names stay readable without growing a tall stack. */}
      <div className="flex flex-row items-center gap-3 lg:gap-6">
        <RunProgressChart
          counts={counts}
          activeStatus={activeStatus}
          onStatusClick={onStatusSelect}
          size={80}
          showLegend={false}
          centerLabel="total"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">
            {formatRunWidePassedLabel(counts)}
            {total > 0 ? <span className="text-slate-500"> · {formatRunWideUntestedLabel(counts)}</span> : null}
          </p>
          <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
            Counts for this entire run, not the current page or section.
          </p>
          <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3 lg:grid-cols-6">
            {items.map((item) => {
              const selected = activeStatus === item.key;
              const percentLabel = item.key === "all" ? "" : ` ${item.percent}%`;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={
                      item.key === "all"
                        ? "All statuses. Clear the status filter."
                        : `${item.label}, ${item.count} of ${total}, ${item.percent} percent. Filter tests by this status.`
                    }
                    onClick={() => onStatusSelect(item.key)}
                    className={[
                      "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs",
                      selected ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"
                    ].join(" ")}
                  >
                    {item.color ? (
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      />
                    ) : (
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-slate-300" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {item.count}
                      {percentLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {hint ? <p className="mt-1.5 text-xs text-slate-600">{hint}</p> : null}
        </div>
      </div>
    </section>
  );
}
