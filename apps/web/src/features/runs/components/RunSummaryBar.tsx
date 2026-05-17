import type { RunDetailDto } from "../types";

type StatusKey = "passed" | "failed" | "blocked" | "retest" | "untested";

const SEGMENTS: Array<{ key: StatusKey; label: string; barClass: string; chipClass: string; activeChip: string }> = [
  {
    key: "passed",
    label: "Passed",
    barClass: "bg-emerald-500",
    chipClass: "bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
    activeChip: "ring-2 ring-emerald-600 ring-offset-1"
  },
  {
    key: "failed",
    label: "Failed",
    barClass: "bg-red-500",
    chipClass: "bg-red-50 text-red-900 hover:bg-red-100",
    activeChip: "ring-2 ring-red-600 ring-offset-1"
  },
  {
    key: "blocked",
    label: "Blocked",
    barClass: "bg-amber-500",
    chipClass: "bg-amber-50 text-amber-900 hover:bg-amber-100",
    activeChip: "ring-2 ring-amber-600 ring-offset-1"
  },
  {
    key: "retest",
    label: "Retest",
    barClass: "bg-violet-500",
    chipClass: "bg-violet-50 text-violet-900 hover:bg-violet-100",
    activeChip: "ring-2 ring-violet-600 ring-offset-1"
  },
  {
    key: "untested",
    label: "Untested",
    barClass: "bg-slate-400",
    chipClass: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    activeChip: "ring-2 ring-slate-600 ring-offset-1"
  }
];

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
  const total =
    counts.passed + counts.failed + counts.blocked + counts.retest + counts.untested;
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
