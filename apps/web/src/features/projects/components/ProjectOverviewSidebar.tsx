import { Link } from "react-router-dom";

import { workbenchDensity as density } from "../../../shared/ui/density/uiDensity";
import type { ProjectOverviewDto } from "../types";

type ProjectOverviewSidebarProps = {
  projectId: string;
  stats: ProjectOverviewDto["stats"];
  recentFailures: ProjectOverviewDto["recentFailures"];
};

const actionLinkClass = "text-xs font-medium text-indigo-800 hover:underline";

export function ProjectOverviewSidebar({ projectId, stats, recentFailures }: ProjectOverviewSidebarProps) {
  const todos = [
    ...recentFailures.slice(0, 4).map((failure) => ({
      id: `${failure.runId}-${failure.caseCode}`,
      label: `Review ${failure.caseCode}`,
      href: `/projects/${projectId}/runs/${failure.runId}`,
      meta: failure.runName
    })),
    ...(stats.activeRuns > 0
      ? [
          {
            id: "active-runs",
            label: `${stats.activeRuns} active run${stats.activeRuns === 1 ? "" : "s"}`,
            href: `/projects/${projectId}/runs`,
            meta: "Open execution"
          }
        ]
      : [])
  ].slice(0, 5);

  return (
    <aside className={density.sidebarStack}>
      <section className={density.sidebarPanel}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Actions</h2>
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-slate-800">Milestones</span>
            <span className="flex gap-2">
              <Link to={`/projects/${projectId}/milestones`} className={actionLinkClass}>
                Add
              </Link>
              <Link to={`/projects/${projectId}/milestones`} className={actionLinkClass}>
                View All
              </Link>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-slate-800">Test Runs</span>
            <span className="flex gap-2">
              <Link to={`/projects/${projectId}/runs/new`} className={actionLinkClass}>
                Add
              </Link>
              <Link to={`/projects/${projectId}/runs`} className={actionLinkClass}>
                View All
              </Link>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-slate-800">Test Cases</span>
            <span className="flex gap-2">
              <Link to={`/projects/${projectId}/cases`} className={actionLinkClass}>
                Add
              </Link>
              <Link to={`/projects/${projectId}/cases`} className={actionLinkClass}>
                View All
              </Link>
            </span>
          </div>
        </div>
      </section>

      <section className={density.sidebarPanel}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Todos</h2>
          <Link to={`/projects/${projectId}/team-todo`} className="text-xs font-medium text-indigo-800 hover:underline">
            View All
          </Link>
        </div>
        {todos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No open project todos.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {todos.map((todo) => (
              <li key={todo.id} className="py-2 text-sm">
                <Link to={todo.href} className="font-medium text-slate-900 hover:underline">
                  {todo.label}
                </Link>
                <p className="text-xs text-slate-500">{todo.meta}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
