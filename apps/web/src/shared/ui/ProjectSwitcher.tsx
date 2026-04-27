import { Link } from "react-router-dom";

import type { ProjectSummary } from "../../features/projects/types";

type ProjectSwitcherProps = {
  projects: ProjectSummary[];
  currentProjectId: string;
};

export function ProjectSwitcher({ projects, currentProjectId }: ProjectSwitcherProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Switch:</span>
      <div className="flex flex-wrap gap-1">
        {projects.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className={
              p.id === currentProjectId
                ? "rounded-md bg-slate-900 px-2 py-0.5 font-medium text-white"
                : "rounded-md px-2 py-0.5 text-slate-700 hover:bg-slate-100"
            }
          >
            {p.name}
          </Link>
        ))}
        <Link to="/projects" className="rounded-md px-2 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          All projects
        </Link>
      </div>
    </div>
  );
}
