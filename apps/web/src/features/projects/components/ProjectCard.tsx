import { Link } from "react-router-dom";

import type { ProjectSummary } from "../types";
import { useProjectOverviewQuery } from "../hooks/useProjectsApi";

type ProjectCardProps = {
  project: ProjectSummary;
};

export function ProjectCard({ project }: ProjectCardProps) {
  const { data: overview, isLoading } = useProjectOverviewQuery(project.id);
  const stats = overview?.stats;
  const leadRun = overview?.recentRuns[0];
  const recentResult = overview?.recentResults[0];
  const projectBase = `/projects/${project.id}`;
  const activeRuns = isLoading ? "..." : String(stats?.activeRuns ?? 0);
  const totalCases = isLoading ? "..." : String(stats?.totalCases ?? 0);

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.75rem] gap-3 border-b border-slate-200 bg-white px-3 py-3 text-sm hover:bg-slate-50">
      <div className="pt-0.5">
        <button
          type="button"
          className="h-5 w-5 border border-slate-300 bg-white text-[10px] font-semibold leading-none text-slate-500 hover:border-slate-400 hover:text-slate-800"
          title="Mark as project favorite"
        >
          F
        </button>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link to={projectBase} className="truncate text-[15px] font-semibold text-blue-700 hover:text-blue-900 hover:underline">
            {project.name}
          </Link>
          {project.isArchived ? (
            <span className="border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600">
              Completed
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
          <Link className="text-blue-700 hover:underline" to={`${projectBase}/my-tests`}>
            Todos
          </Link>
          <span>|</span>
          <Link className="text-blue-700 hover:underline" to={`${projectBase}/milestones`}>
            Milestones
          </Link>
          <span>|</span>
          <Link className="text-blue-700 hover:underline" to={`${projectBase}/runs`}>
            Test Runs
          </Link>
          <span>|</span>
          <Link className="text-blue-700 hover:underline" to={`${projectBase}/cases`}>
            Test Cases
          </Link>
          <span>|</span>
          <Link className="text-blue-700 hover:underline" to={`${projectBase}/reports`}>
            Reports
          </Link>
        </div>

        <p className="mt-2 text-xs text-slate-600">
          Contains <strong className="font-semibold text-slate-800">{totalCases}</strong> test cases and{" "}
          <strong className="font-semibold text-slate-800">{activeRuns}</strong> active test runs.
          {stats?.recentFailures ? (
            <>
              {" "}
              <Link className="font-medium text-red-700 hover:underline" to={`${projectBase}/reports`}>
                {stats.recentFailures} recent failures
              </Link>
              .
            </>
          ) : null}
        </p>

        {project.description ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{project.description}</p> : null}

        {leadRun || recentResult ? (
          <div className="mt-2 grid gap-2 text-xs text-slate-500 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {leadRun ? (
              <Link to={`${projectBase}/runs/${leadRun.id}`} className="min-w-0 hover:text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="truncate">Latest run: {leadRun.name}</span>
                  <span className="shrink-0 text-slate-400">{leadRun.progress}%</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden bg-slate-100">
                  <div className="h-full bg-blue-700" style={{ width: `${Math.min(100, Math.max(0, leadRun.progress))}%` }} />
                </div>
              </Link>
            ) : null}
            {recentResult ? (
              <div className="truncate">
                {recentResult.caseCode} marked <span className="font-medium text-slate-700">{recentResult.status}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="pt-1">
        {!project.isArchived && Number(stats?.activeRuns ?? 0) > 0 ? (
          <Link to={`${projectBase}/runs`} className="block h-8 w-8 border border-slate-300 bg-white text-center text-lg leading-7 text-slate-500 hover:bg-slate-100">
            +
          </Link>
        ) : null}
      </div>
    </div>
  );
}
