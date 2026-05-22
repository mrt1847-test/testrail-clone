import { Link } from "react-router-dom";

import { workbenchDensity as density } from "../../../shared/ui/density/uiDensity";
import type { MilestoneSummaryPayload } from "../api/milestoneSummaryApi";
import type { PlanRow } from "../api/planningApi";
import type { ProjectOverviewDto } from "../types";

type ProjectOverviewColumnsProps = {
  projectId: string;
  milestones?: MilestoneSummaryPayload;
  recentRuns: ProjectOverviewDto["recentRuns"];
  plans: PlanRow[];
};

function formatDate(value?: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export function ProjectOverviewColumns({ projectId, milestones, recentRuns, plans }: ProjectOverviewColumnsProps) {
  const milestoneRows = (milestones?.items ?? [])
    .filter((row) => row.lifecycleStatus !== "completed")
    .slice()
    .sort((a, b) => (a.forecast.projectedCompletionDate ?? "").localeCompare(b.forecast.projectedCompletionDate ?? ""))
    .slice(0, 5);
  const planRows = plans.slice(0, 3);
  const runRows = recentRuns.slice(0, 4);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className={density.panel}>
        <div className={`flex items-center justify-between ${density.panelHeader}`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Milestones</h2>
          <Link to={`/projects/${projectId}/milestones`} className="text-xs font-medium text-indigo-800 hover:underline">
            View All
          </Link>
        </div>
        {milestoneRows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No open milestones.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {milestoneRows.map((row) => (
              <li key={row.milestoneId} className="flex items-start gap-2.5 px-3 py-2 text-sm">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500">
                  M
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/projects/${projectId}/milestones/${row.milestoneId}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {row.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {row.openRunCount} active runs / {row.progress}% passed
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={density.panel}>
        <div className={`flex items-center justify-between ${density.panelHeader}`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Test Runs & Plans</h2>
          <Link to={`/projects/${projectId}/runs`} className="text-xs font-medium text-indigo-800 hover:underline">
            View All
          </Link>
        </div>
        {planRows.length === 0 && runRows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">No recent runs or plans.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {planRows.map((plan) => (
              <li key={`plan-${plan.id}`} className="flex items-start gap-2.5 px-3 py-2 text-sm">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500">
                  P
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${projectId}/plans/${plan.id}`} className="font-medium text-slate-900 hover:underline">
                    {plan.name}
                  </Link>
                  <p className="text-xs text-slate-500">{formatDate(plan.dueOn)}</p>
                </div>
              </li>
            ))}
            {runRows.map((run) => (
              <li key={`run-${run.id}`} className="flex items-start gap-2.5 px-3 py-2 text-sm">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-500">
                  R
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${projectId}/runs/${run.id}`} className="font-medium text-slate-900 hover:underline">
                    {run.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {run.status} / {run.progress}% / {run.failed} failed
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
