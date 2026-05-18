import { Link } from "react-router-dom";

type MilestoneProgressBarProps = {
  projectId: string;
  milestoneId: string;
  total: number;
  passed: number;
  failed: number;
  className?: string;
};

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function MilestoneProgressBar({
  projectId,
  milestoneId,
  total,
  passed,
  failed,
  className = ""
}: MilestoneProgressBarProps) {
  const safeTotal = Math.max(0, total);
  const safePassed = Math.max(0, passed);
  const safeFailed = Math.max(0, failed);
  const untested = Math.max(0, safeTotal - safePassed - safeFailed);
  const passedPercent = percent(safePassed, safeTotal);
  const failedPercent = percent(safeFailed, safeTotal);
  const untestedPercent = percent(untested, safeTotal);
  const runsHref = `/projects/${projectId}/runs?milestoneId=${milestoneId}`;

  const segments = [
    {
      key: "passed",
      label: "Passed",
      value: safePassed,
      pct: passedPercent,
      color: "#3cb850",
      href: `${runsHref}&resultStatus=passed`
    },
    {
      key: "failed",
      label: "Failed",
      value: safeFailed,
      pct: failedPercent,
      color: "#e40046",
      href: `${runsHref}&resultStatus=failed`
    },
    {
      key: "untested",
      label: "Untested",
      value: untested,
      pct: untestedPercent,
      color: "#979797",
      href: `${runsHref}&resultStatus=untested`
    }
  ].filter((segment) => segment.value > 0);

  return (
    <div className={className}>
      <div
        className="flex h-5 w-full overflow-hidden rounded border border-slate-300 bg-white"
        aria-label={`${passedPercent}% passed, ${failedPercent}% failed, ${untestedPercent}% untested`}
      >
        {safeTotal === 0 ? (
          <div className="h-full w-full bg-transparent" title="0% - no tests yet" />
        ) : (
          segments.map((segment) => (
            <Link
              key={segment.key}
              to={segment.href}
              className="block h-full min-w-[2px] hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-900"
              style={{ width: `${segment.pct}%`, backgroundColor: segment.color }}
              aria-label={`Show ${segment.label.toLowerCase()} runs for this milestone`}
              title={`${segment.label}: ${segment.pct}% (${segment.value}/${safeTotal})`}
            />
          ))
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-600">
        <span className="font-medium text-slate-900">{passedPercent}%</span>
        <span>
          {safePassed}/{safeTotal} passed
        </span>
      </div>
    </div>
  );
}
