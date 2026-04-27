import { Link, Outlet, useParams } from "react-router-dom";

import { AppShell } from "../../../shared/ui/AppShell";
import { Breadcrumb } from "../../../shared/ui/Breadcrumb";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ProjectHeader } from "../../../shared/ui/ProjectHeader";
import { ProjectSwitcher } from "../../../shared/ui/ProjectSwitcher";
import { ProjectTabs } from "../../../shared/ui/ProjectTabs";
import { useProjectQuery, useProjectsQuery } from "../hooks/useProjectsApi";

export function ProjectLayout() {
  const { projectId = "" } = useParams();
  const { data: project, isLoading, isError, refetch } = useProjectQuery(projectId);
  const { data: allProjects = [] } = useProjectsQuery();

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingState message="Loading project…" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-6">
        <ErrorState title="Project not found" onRetry={() => refetch()} />
        <p className="mt-4 text-center text-sm">
          <Link to="/projects" className="text-slate-700 underline">
            Back to projects
          </Link>
        </p>
      </div>
    );
  }

  const top = (
    <>
      <div className="border-b border-slate-200 bg-white px-4 py-2">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Link to="/projects" className="text-lg font-semibold tracking-tight text-slate-900">
            QA Rail
          </Link>
          <ProjectSwitcher projects={allProjects} currentProjectId={projectId} />
        </div>
      </div>
      <ProjectHeader projectName={project.name} subtitle={project.description} />
      <ProjectTabs projectId={projectId} />
      <Breadcrumb projectId={projectId} projectName={project.name} />
    </>
  );

  return (
    <AppShell top={top}>
      <Outlet />
    </AppShell>
  );
}
