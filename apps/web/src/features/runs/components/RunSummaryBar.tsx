import type { RunDetailDto } from "../types";
import { RUN_STATUS_SEGMENTS, runStatusTotal } from "../utils/runProgressSegments";

const SEGMENTS = RUN_STATUS_SEGMENTS;

type Props = {
  counts: RunDetailDto["counts"];
  activeStatus?: string;
  onStatusClick?: (status: string) => void;
  /** `compact` = progress bar only (use with status sidebar on desktop). */
  mode?: "full" | "compact";
  className?: string;
};

function RunProgressBar({ counts, total }: { counts: RunDetailDto["counts"]; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
      {SEGMENTS.map((segment) =>
        counts[segment.key] > 0 ? (
          <div
            key={segment.key}
            className={segment.barClass}
            style={{ width: `${(counts[segment.key] / total) * 100}%` }}
            title={`${segment.label}: ${counts[segment.key]}`}
          />
        ) : null
      )}
    </div>
  );
}

export function RunSummaryBar({
  counts,
  activeStatus = "all",
  onStatusClick,
  mode = "full",
  className = ""
}: Props) {
  const total = runStatusTotal(counts);
  const interactive = Boolean(onStatusClick);

  if (mode === "compact") {
    return (
      <div className={`flex items-center gap-3 ${className}`.trim()}>
        <RunProgressBar counts={counts} total={total} />
        <p className="shrink-0 text-xs tabular-nums text-slate-500">
          {total} tests ·{" "}
          {total > 0
            ? Math.round(
                ((counts.passed + counts.failed + counts.blocked + counts.retest) / total) * 100
              )
            : 0}
          % done
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${className}`.trim()}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Progress</p>
        <p className="text-xs text-slate-500 sm:text-right">
          <span className="font-medium text-slate-600">Tests in run:</span> {total}
        </p>
      </div>

      <RunProgressBar counts={counts} total={total} />

      <div className="flex flex-wrap gap-2 text-sm">
        {SEGMENTS.map((segment) => {
          const isActive = activeStatus === segment.key;
          const chipClass = [
            "rounded-md px-2 py-1 font-medium transition-colors",
            segment.chipClass,
            isActive ? segment.activeChip : "",
            interactive ? "cursor-pointer" : ""
          ]
            .filter(Boolean)
            .join(" ");

          if (interactive) {
            return (
              <button
                key={segment.key}
                type="button"
                className={chipClass}
                aria-pressed={isActive}
                onClick={() => onStatusClick?.(segment.key)}
              >
                {segment.label} {counts[segment.key]}
              </button>
            );
          }

          return (
            <span key={segment.key} className={chipClass}>
              {segment.label} {counts[segment.key]}
            </span>
          );
        })}
        {interactive ? (
          <button
            type="button"
            className={[
              "rounded-md px-2 py-1 font-medium transition-colors",
              activeStatus === "all"
                ? "bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-1"
                : "bg-slate-50 text-slate-800 hover:bg-slate-100"
            ].join(" ")}
            aria-pressed={activeStatus === "all"}
            onClick={() => onStatusClick?.("all")}
          >
            All {total}
          </button>
        ) : null}
      </div>
    </div>
  );
}
