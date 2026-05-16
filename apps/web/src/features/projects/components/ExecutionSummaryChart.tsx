import { Link } from "react-router-dom";

import type { ProjectOverviewDto } from "../types";

type ExecutionSummaryChartProps = {
  projectId: string;
  execution: ProjectOverviewDto["execution"];
  compact?: boolean;
};

export function ExecutionSummaryChart({ projectId, execution, compact = false }: ExecutionSummaryChartProps) {
  const total = execution.total;
  const runsBase = `/projects/${projectId}/runs`;
  const segments = [
    {
      label: "Passed",
      value: execution.passed,
      className: "bg-emerald-500",
      textClassName: "text-emerald-700",
      href: runsBase
    },
    {
      label: "Failed",
      value: execution.failed,
      className: "bg-red-500",
      textClassName: "text-red-700",
      href: runsBase
    },
    {
      label: "Remaining",
      value: execution.remaining,
      className: "bg-slate-300",
      textClassName: "text-slate-600",
      href: runsBase
    }
  ];
  const executed = execution.passed + execution.failed;
  const executedPct = total > 0 ? Math.round((executed / total) * 100) : 0;

  const bar = (
    <div className={`overflow-hidden rounded bg-slate-100 ${compact ? "h-2 flex-1" : "mt-4 h-4"}`}>
      {total > 0 ? (
        <div className="flex h-full">
          {segments.map((segment) =>
            segment.value > 0 ? (
              <div
                key={segment.label}
                className={segment.className}
                style={{ width: `${Math.max(2, (segment.value / total) * 100)}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Execution</p>
        {bar}
        <p className="text-xs tabular-nums text-slate-600">
          {executedPct}% ·{" "}
          <Link to={runsBase} className="font-medium text-emerald-700 hover:underline">
            {execution.passed}P
          </Link>{" "}
          <Link to={runsBase} className="font-medium text-red-700 hover:underline">
            {execution.failed}F
          </Link>{" "}
          / {total}
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Test Execution</h2>
          <p className="mt-1 text-sm text-slate-500">Current result distribution across test runs.</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xl font-semibold text-slate-900">{executedPct}%</p>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Executed</p>
        </div>
      </div>
      {bar}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total tests</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{total}</p>
        </div>
        {segments.map((segment) => (
          <div key={segment.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{segment.label}</p>
            <Link to={segment.href} className={`mt-1 block text-xl font-semibold hover:underline ${segment.textClassName}`}>
              {segment.value}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
