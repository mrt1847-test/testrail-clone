import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../../shared/ui";
import { AppShell } from "../../../shared/ui/AppShell";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ThemePreferenceSelect } from "../../../shared/theme/ThemePreferenceSelect";
import { useAuth } from "../../auth/context/AuthContext";
import { useCreateProjectMutation, useProjectsQuery } from "../hooks/useProjectsApi";
import { projectListCreatePlacement } from "../utils/projectListModel";
import { CrossProjectGlobalSearch } from "./CrossProjectGlobalSearch";
import { ProjectCard } from "./ProjectCard";
import { ProjectCreateDialog } from "./ProjectCreateDialog";
import { ProjectEmptyState } from "./ProjectEmptyState";

export function ProjectListPage() {
  const navigate = useNavigate();
  const { user, memberships, logout } = useAuth();
  const { data: projects, isLoading, isError, refetch } = useProjectsQuery();
  const createMutation = useCreateProjectMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isInstanceAdmin = memberships.some((m) => m.role === "owner") || memberships.length === 0;
  const canCreate = Boolean(user);
  const list = projects ?? [];
  const createPlacement = projectListCreatePlacement({ canCreate, projectCount: list.length });
  const activeProjects = list.filter((project) => !project.isArchived);
  const completedProjects = list.filter((project) => project.isArchived);

  const openCreate = () => setDialogOpen(true);

  const top = (
    <div className="shell-bar border-b border-slate-300 dark:border-slate-700">
      <div className="flex min-h-12 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Link
            to="/projects"
            className="shrink-0 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            QA Rail
          </Link>
          <CrossProjectGlobalSearch />
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          <ThemePreferenceSelect compact />
          <span className="max-w-56 truncate text-slate-600 dark:text-slate-400">{user?.email ?? "unknown"}</span>
          <button type="button" onClick={() => void logout()} className="text-slate-600 hover:text-blue-700 dark:text-slate-400">
            Logout
          </button>
        </div>
      </div>
      <div className="flex h-10 items-center justify-between bg-slate-50 px-4 dark:bg-slate-900">
        <nav className="flex h-full items-center">
          <Link
            to="/projects"
            className="flex h-full items-center border-x border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            Projects
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {isInstanceAdmin ? (
            <Link
              to="/admin/users"
              className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Users & groups
            </Link>
          ) : null}
          {createPlacement === "header" ? (
            <Button size="sm" onClick={openCreate}>
              Add project
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );

  const dialog = (
    <ProjectCreateDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      isSubmitting={createMutation.isPending}
      onSubmit={(input) => {
        createMutation.mutate(input, {
          onSuccess: (created) => {
            setDialogOpen(false);
            navigate(`/projects/${created.id}`);
          }
        });
      }}
    />
  );

  if (isLoading) {
    return (
      <AppShell top={top}>
        <LoadingState message="Loading projects..." />
        {dialog}
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell top={top}>
        <ErrorState onRetry={() => refetch()} />
        {dialog}
      </AppShell>
    );
  }

  return (
    <AppShell top={top}>
      <main className="min-w-0 px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">Projects</h1>
        {list.length === 0 ? (
          <div className="mt-6">
            <ProjectEmptyState onCreateClick={createPlacement === "empty" ? openCreate : undefined} />
          </div>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
              {activeProjects.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-slate-900">Completed</h2>
              {completedProjects.length > 0 ? (
                <ul className="mt-1 divide-y divide-slate-200 border-y border-slate-200">
                  {completedProjects.map((project) => (
                    <li key={project.id} className="flex items-center justify-between gap-3 py-2">
                      <Link to={`/projects/${project.id}`} className="min-w-0 truncate font-medium text-slate-900 hover:underline">
                        {project.name}
                      </Link>
                      <span className="shrink-0 text-xs text-slate-500">Completed</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-500">No completed projects.</p>
              )}
            </section>
          </>
        )}
      </main>
      {dialog}
    </AppShell>
  );
}
