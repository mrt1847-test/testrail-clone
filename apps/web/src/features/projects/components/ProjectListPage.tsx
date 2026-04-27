import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";
import { AppShell } from "../../../shared/ui/AppShell";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { ProjectCard } from "./ProjectCard";
import { ProjectCreateDialog } from "./ProjectCreateDialog";
import { ProjectEmptyState } from "./ProjectEmptyState";
import { useCreateProjectMutation, useProjectsQuery } from "../hooks/useProjectsApi";

export function ProjectListPage() {
  const navigate = useNavigate();
  const { user, memberships, logout } = useAuth();
  const { data: projects, isLoading, isError, refetch } = useProjectsQuery();
  const createMutation = useCreateProjectMutation();
  const [dialogOpen, setDialogOpen] = useState(false);

  const top = (
    <div className="border-b border-slate-200 bg-white px-4 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">QA Rail</h1>
          <p className="text-xs text-slate-500">
            {user?.email ?? "unknown"} · memberships {memberships.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <LoadingState message="Loading projects…" />
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">My projects</h2>
        {list.length === 0 ? (
          <div className="mt-6">
            <ProjectEmptyState onCreateClick={() => setDialogOpen(true)} />
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} />
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="flex h-full min-h-[140px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              >
                + New project
              </button>
            </li>
          </ul>
        )}
      </section>

      <ProjectCreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        isSubmitting={createMutation.isPending}
        onSubmit={(name) => {
          createMutation.mutate(name, {
            onSuccess: (created) => {
              setDialogOpen(false);
              navigate(`/projects/${created.id}`);
            },
          });
        }}
      />
    </AppShell>
  );
}
