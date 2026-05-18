import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AppShell } from "../../../shared/ui/AppShell";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useAuth } from "../../auth/context/AuthContext";
import { useCreateProjectMutation, useProjectsQuery } from "../hooks/useProjectsApi";
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

  const top = (
    <div className="border-b border-slate-300 bg-white">
      <div className="flex min-h-12 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-4">
          <Link to="/projects" className="text-lg font-semibold tracking-tight text-slate-900">
            QA Rail
          </Link>
          <span className="border-l border-slate-300 pl-4 text-sm font-medium text-slate-600">Gmarket QA</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link to="/projects" className="font-medium text-slate-700 hover:text-blue-700">
            Working On
          </Link>
          <span className="text-slate-300">|</span>
          <span className="max-w-56 truncate text-slate-600">{user?.email ?? "unknown"}</span>
          <button type="button" onClick={() => void logout()} className="text-slate-600 hover:text-blue-700">
            Logout
          </button>
        </div>
      </div>
      <div className="flex h-10 items-center justify-between bg-slate-50 px-4">
        <nav className="flex h-full items-center">
          <Link to="/projects" className="flex h-full items-center border-x border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900">
            Dashboard
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {isInstanceAdmin ? (
            <>
              <Link
                to="/admin/users"
                className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Users & groups
              </Link>
              <Link
                to="/admin/access-defaults"
                className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Access defaults
              </Link>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="border border-blue-800 bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
          >
            New project
          </button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <AppShell top={top}>
        <LoadingState message="Loading projects..." />
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell top={top}>
        <ErrorState onRetry={() => refetch()} />
      </AppShell>
    );
  }

  const list = projects ?? [];
  const activeProjects = list.filter((project) => !project.isArchived);
  const completedProjects = list.filter((project) => project.isArchived);

  return (
    <AppShell top={top}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0">
          <div className="border-b border-slate-300 bg-white px-3 py-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-slate-900">All Projects</h1>
              <div className="flex gap-1">
                <button type="button" className="border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                  Compact
                </button>
                <button type="button" className="border border-blue-700 bg-white px-2 py-1 text-xs font-medium text-blue-700">
                  Detail
                </button>
              </div>
            </div>
          </div>

          {list.length === 0 ? (
            <div className="mt-4">
              <ProjectEmptyState onCreateClick={() => setDialogOpen(true)} />
            </div>
          ) : (
            <>
              <section className="mt-4">
                <h2 className="mb-2 text-base font-semibold text-slate-900">Projects</h2>
                <div className="border border-slate-300 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-600">
                    Active
                  </div>
                  <ul>
                    {activeProjects.map((p) => (
                      <li key={p.id}>
                        <ProjectCard project={p} />
                      </li>
                    ))}
                    <li className="bg-white px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setDialogOpen(true)}
                        className="border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:border-slate-400 hover:bg-slate-50"
                      >
                        Add Project
                      </button>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="mt-6">
                <h2 className="mb-2 text-base font-semibold text-slate-900">Completed</h2>
                {completedProjects.length > 0 ? (
                  <div className="overflow-hidden border border-slate-300 bg-white">
                    <table className="w-full border-collapse text-sm">
                      <colgroup>
                        <col className="w-10" />
                        <col />
                        <col className="w-32" />
                      </colgroup>
                      <tbody>
                        {completedProjects.map((project, index) => (
                          <tr key={project.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="border-b border-slate-200 px-3 py-2 text-xs text-slate-400">Fav</td>
                            <td className="border-b border-slate-200 px-2 py-2">
                              <Link to={`/projects/${project.id}`} className="font-medium text-blue-700 hover:underline">
                                {project.name}
                              </Link>
                            </td>
                            <td className="border-b border-slate-200 px-3 py-2 text-right text-xs text-slate-500">Completed</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="border border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">No completed projects.</p>
                )}
              </section>
            </>
          )}
        </main>

        <aside className="border-l border-slate-300 pl-5">
          <div className="bg-white">
            <h2 className="border-b border-slate-300 pb-2 text-base font-semibold text-slate-900">Todos</h2>
            <p className="mt-3 text-sm text-slate-600">
              <strong className="font-semibold text-slate-900">{activeProjects.length}</strong> active and{" "}
              <strong className="font-semibold text-slate-900">{completedProjects.length}</strong> completed projects.
            </p>
            <div className="mt-4 border border-slate-300">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-600">
                Quick Links
              </div>
              <div className="grid gap-0 text-sm">
                <Link to="/projects" className="border-b border-slate-200 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline">
                  All projects
                </Link>
                <button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  className="px-3 py-2 text-left text-sm text-blue-700 hover:bg-slate-50 hover:underline"
                >
                  Add project
                </button>
                {isInstanceAdmin ? (
                  <Link to="/admin/users" className="border-t border-slate-200 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline">
                    Users & groups
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>

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
    </AppShell>
  );
}
