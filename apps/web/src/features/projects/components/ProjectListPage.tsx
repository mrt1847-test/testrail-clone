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
    <div className="border-b border-slate-200 bg-white px-4 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">QA Rail</h1>
          <p className="text-xs text-slate-500">
            {user?.email ?? "unknown"} - memberships {memberships.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isInstanceAdmin ? (
            <>
              <Link
                to="/admin/users"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Users & groups
              </Link>
              <Link
                to="/admin/access-defaults"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Access defaults
              </Link>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New project
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Logout
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

  return (
    <AppShell top={top}>
      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">My projects</h2>
            <p className="mt-1 text-sm text-slate-500">Project status, recent execution, and result activity at a glance.</p>
          </div>
          <p className="text-xs text-slate-500">
            {list.length} project{list.length === 1 ? "" : "s"}
          </p>
        </div>
        {list.length === 0 ? (
          <div className="mt-6">
            <ProjectEmptyState onCreateClick={() => setDialogOpen(true)} />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-600 lg:grid lg:grid-cols-[minmax(14rem,1.2fr)_2fr_auto]">
              <span>Project</span>
              <span>Summary</span>
              <span className="w-64">Activity</span>
            </div>
            <ul>
              {list.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} />
                </li>
              ))}
              <li className="bg-white px-4 py-4">
                <button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  className="flex w-full items-center justify-center rounded border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                >
                  + New project
                </button>
              </li>
            </ul>
          </div>
        )}
      </section>

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
