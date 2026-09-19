import { useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "../../../shared/ui/AppShell";
import { Breadcrumb } from "../../../shared/ui/Breadcrumb";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { OverflowMenu } from "../../../shared/ui/OverflowMenu";
import { ProjectSwitcher } from "../../../shared/ui/ProjectSwitcher";
import { ProjectTabs } from "../../../shared/ui/ProjectTabs";
import { useTheme } from "../../../shared/theme/ThemeProvider";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchNotifications } from "../api/advancedApi";
import { ArchivedProjectBanner } from "./ArchivedProjectBanner";
import { ProjectArchiveProvider } from "../context/ProjectArchiveContext";
import { useProjectQuery, useProjectsQuery } from "../hooks/useProjectsApi";
import { isPrimaryProjectTabPath } from "../utils/primaryProjectTabPath";
import { buildProjectAccountMenu } from "../utils/projectAccountMenu";
import { EntityContextMenuProvider } from "../../../shared/ui/EntityContextMenu";
import { ProjectCommandPalette, useProjectCommandPalette } from "./ProjectCommandPalette";
import { ProjectGlobalSearch } from "./ProjectGlobalSearch";

export function ProjectLayout() {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const commandPalette = useProjectCommandPalette();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const [narrowSearchOpen, setNarrowSearchOpen] = useState(false);
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
      <div className="shell-bar border-b px-4 py-1.5">
        <div className="mx-auto flex max-w-[90rem] min-w-0 flex-nowrap items-center gap-2">
          <Link
            to="/projects"
            className="shrink-0 text-sm font-semibold tracking-tight text-slate-900 sm:text-lg dark:text-slate-100"
          >
            QA Rail
          </Link>
          <div className="min-w-0 flex-1">
            <ProjectSwitcher
              projects={allProjects}
              currentProjectId={projectId}
              isArchived={project.isArchived}
            />
          </div>
          <div className="hidden min-w-[12rem] max-w-md flex-1 sm:block">
            <ProjectGlobalSearch projectId={projectId} />
          </div>
          <OverflowMenu
            label="Account"
            size="sm"
            align="right"
            groups={buildProjectAccountMenu({
              projectId,
              unreadCount: notifications?.unreadCount,
              theme: preference,
              userEmail: user?.email,
              includeSearch: true,
              onJumpTo: () => commandPalette.setOpen(true),
              onSearch: () => {
                if (window.matchMedia("(min-width: 640px)").matches) {
                  document.getElementById("project-global-search")?.focus();
                  return;
                }
                setNarrowSearchOpen(true);
              },
              onTheme: setPreference,
              onLogout: () => void logout()
            })}
          />
        </div>
      </div>
      {narrowSearchOpen ? (
        <div className="shell-bar border-b px-4 py-1.5 sm:hidden">
          <ProjectGlobalSearch
            projectId={projectId}
            inputId="project-global-search-narrow"
            autoFocus
          />
        </div>
      ) : null}
      <ArchivedProjectBanner />
      <ProjectTabs projectId={projectId} />
      {isPrimaryProjectTabPath(location.pathname) ? null : (
        <Breadcrumb projectId={projectId} projectName={project.name} />
      )}
    </>
  );

  return (
    <ProjectArchiveProvider isArchived={Boolean(project.isArchived)}>
      <EntityContextMenuProvider>
        <ProjectCommandPalette
          projectId={projectId}
          open={commandPalette.open}
          onClose={commandPalette.onClose}
        />
        <AppShell top={top}>
          <Outlet />
        </AppShell>
      </EntityContextMenuProvider>
    </ProjectArchiveProvider>
  );
}
