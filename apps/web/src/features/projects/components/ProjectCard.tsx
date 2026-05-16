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

  return (
    <div className="grid gap-4 border-b border-slate-100 bg-white px-4 py-4 transition hover:bg-slate-50/80 lg:grid-cols-[minmax(14rem,1.2fr)_2fr_auto] lg:items-center">
      <div className="min-w-0">
        <Link to={`/projects/${project.id}`} className="text-base font-semibold text-slate-900 hover:text-slate-700">
          {project.name}
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description || "No description"}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Cases" value={isLoading ? "..." : String(stats?.totalCases ?? 0)} />
        <Metric label="Active runs" value={isLoading ? "..." : String(stats?.activeRuns ?? 0)} />
        <Metric label="Failures" value={isLoading ? "..." : String(stats?.recentFailures ?? 0)} tone={stats?.recentFailures ? "red" : "slate"} />
        <Metric label="Automation" value={isLoading ? "..." : `${stats?.automationCoveragePct ?? 0}%`} />
      </div>

      <div className="min-w-0 lg:w-64">
        <div className="rounded border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest activity</p>
          {leadRun ? (
            <div className="mt-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-slate-800">{leadRun.name}</span>
                <span className="text-slate-500">{leadRun.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-800" style={{ width: `${Math.min(100, Math.max(0, leadRun.progress))}%` }} />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No runs yet</p>
          )}
          {recentResult ? (
            <p className="mt-2 truncate text-xs text-slate-500">
              {recentResult.caseCode} marked <span className="font-medium text-slate-700">{recentResult.status}</span>
            </p>
          ) : null}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Link to={`/projects/${project.id}/cases`} className="text-xs font-medium text-slate-600 hover:text-slate-900">
            Cases
          </Link>
          <Link to={`/projects/${project.id}/runs`} className="text-xs font-medium text-slate-600 hover:text-slate-900">
            Runs
          </Link>
          <Link to={`/projects/${project.id}`} className="text-xs font-semibold text-slate-900 hover:text-slate-700">
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "red" }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === "red" ? "text-red-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
