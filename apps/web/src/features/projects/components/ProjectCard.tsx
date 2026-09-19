import { Link } from "react-router-dom";

import type { ProjectSummary } from "../types";
import { usePinnedProjects } from "../hooks/usePinnedProjects";
import { useProjectOverviewQuery } from "../hooks/useProjectsApi";
import { formatProjectListProgress, projectListNavLinks } from "../utils/projectListModel";

type ProjectCardProps = {
  project: ProjectSummary;
};

export function ProjectCard({ project }: ProjectCardProps) {
  const { isProjectPinned, toggleProjectPin } = usePinnedProjects();
  const pinned = isProjectPinned(project.id);
  const { data: overview, isLoading } = useProjectOverviewQuery(project.id);
  const stats = overview?.stats;
  const leadRun = overview?.recentRuns.find((run) => run.status !== "closed") ?? overview?.recentRuns[0];
  const projectBase = `/projects/${project.id}`;

  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 py-2.5">
      <button
        type="button"
        className="h-6 w-6 text-sm leading-6 text-slate-500 hover:text-slate-800"
        title={pinned ? "Unpin project" : "Pin project"}
        aria-label={pinned ? "Unpin project" : "Pin project"}
        aria-pressed={pinned}
        onClick={() => toggleProjectPin(project.id)}
      >
        {pinned ? "★" : "☆"}
      </button>
      <div className="min-w-0">
        <Link to={projectBase} className="block truncate font-medium text-slate-900 hover:underline">
          {project.name}
        </Link>
        <p className="mt-0.5 text-xs text-slate-600">
          {formatProjectListProgress({
            totalCases: stats?.totalCases,
            activeRuns: stats?.activeRuns,
            loading: isLoading
          })}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {projectListNavLinks(project.id).map((link) => (
            <Link key={link.to} to={link.to} className="text-slate-700 hover:underline">
              {link.label}
            </Link>
          ))}
        </div>
        {leadRun ? (
          <Link to={`${projectBase}/runs/${leadRun.id}`} className="mt-1 block truncate text-xs text-slate-600 hover:underline">
            Open {leadRun.name}
            {leadRun.total > 0 ? ` · ${leadRun.passed} of ${leadRun.total} passed` : ""}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
