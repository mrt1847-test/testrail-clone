import { Link } from "react-router-dom";

import type { ProjectSummary } from "../types";

type ProjectCardProps = {
  project: ProjectSummary;
};

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{project.name}</h2>
        {project.description ? <p className="mt-1 text-sm text-slate-600">{project.description}</p> : null}
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          to={`/projects/${project.id}`}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open
        </Link>
        <Link
          to={`/projects/${project.id}/cases`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
        >
          Test Cases
        </Link>
      </div>
    </div>
  );
}
