import { Link, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "../../../shared/ui/AppShell";
import { Breadcrumb } from "../../../shared/ui/Breadcrumb";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ProjectHeader } from "../../../shared/ui/ProjectHeader";
import { ProjectSwitcher } from "../../../shared/ui/ProjectSwitcher";
import { ProjectTabs } from "../../../shared/ui/ProjectTabs";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchNotifications } from "../api/advancedApi";
import { ArchivedProjectBanner } from "./ArchivedProjectBanner";
import { ProjectArchiveProvider } from "../context/ProjectArchiveContext";
import { useProjectQuery, useProjectsQuery } from "../hooks/useProjectsApi";

export function ProjectLayout() {
  const { projectId = "" } = useParams();
  const { user, logout } = useAuth();
  const { data: project, isLoading, isError, refetch } = useProjectQuery(projectId);
  const { data: allProjects = [] } = useProjectsQuery();
  const { data: notifications } = useQuery({
    queryKey: ["notifications", projectId, "shell"],
    queryFn: () => fetchNotifications(projectId, 1, 1),
    enabled: Boolean(projectId && user)
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingState message="Loading project..." />
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
          <div className="flex items-center gap-3">
            <ProjectSwitcher projects={allProjects} currentProjectId={projectId} />
            <Link
              to={`/projects/${projectId}/notifications`}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Inbox {notifications?.unreadCount ? `(${notifications.unreadCount})` : ""}
            </Link>
            <div className="text-right">
              <p className="text-xs text-slate-500">{user?.email ?? "unknown user"}</p>
              <button
                type="button"
                onClick={() => void logout()}
                className="text-xs font-medium text-slate-700 underline"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
      <ProjectHeader projectName={project.name} subtitle={project.description} isArchived={project.isArchived} />
      <ArchivedProjectBanner />
      <ProjectTabs projectId={projectId} />
      <Breadcrumb projectId={projectId} projectName={project.name} />
    </>
  );

  return (
    <ProjectArchiveProvider isArchived={Boolean(project.isArchived)}>
      <AppShell top={top}>
        <Outlet />
      </AppShell>
    </ProjectArchiveProvider>
  );
}
