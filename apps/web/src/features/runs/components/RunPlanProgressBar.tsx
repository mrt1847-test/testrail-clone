import { RUN_STATUS_SEGMENTS, runStatusTotal } from "../utils/runProgressSegments";

type RunPlanProgressBarProps = {
  statusCounts: Record<string, number>;
  className?: string;
};

export function RunPlanProgressBar({ statusCounts, className = "" }: RunPlanProgressBarProps) {
  const counts = {
    passed: statusCounts.passed ?? 0,
    failed: statusCounts.failed ?? 0,
    blocked: statusCounts.blocked ?? 0,
    retest: statusCounts.retest ?? 0,
    untested: statusCounts.untested ?? 0
  };
  const total = runStatusTotal(counts);
  const passedPercent = total === 0 ? 0 : Math.round((counts.passed / total) * 100);

  return (
    <div className={className}>
      <div
        className="flex h-5 w-full overflow-hidden rounded border border-slate-300 bg-white dark:border-slate-600"
        aria-label={`${passedPercent}% passed`}
      >
        {total === 0 ? (
          <div className="h-full w-full bg-slate-100 dark:bg-slate-800" title="No tests yet" />
        ) : (
          RUN_STATUS_SEGMENTS.map((segment) =>
            counts[segment.key] > 0 ? (
              <div
                key={segment.key}
                className={`h-full min-w-[2px] ${segment.barClass}`}
                style={{ width: `${(counts[segment.key] / total) * 100}%` }}
                title={`${segment.label}: ${counts[segment.key]}/${total}`}
              />
            ) : null
          )
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-medium text-slate-900 dark:text-slate-100">{passedPercent}% passed</span>
        <span>
          {counts.passed}/{total} passed · {counts.failed} failed
        </span>
      </div>
    </div>
  );
}
