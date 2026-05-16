import { Link, useParams } from "react-router-dom";

import { PROJECT_TYPE_LABELS } from "../types/projectTypes";
import { useArchiveProjectMutation, useProjectQuery, useRestoreProjectMutation } from "../hooks/useProjectsApi";

export function ProjectSettingsPage() {
  const { projectId = "" } = useParams();
  const projectQuery = useProjectQuery(projectId);
  const archiveMutation = useArchiveProjectMutation(projectId);
  const restoreMutation = useRestoreProjectMutation(projectId);
  const project = projectQuery.data;
  const isArchived = Boolean(project?.isArchived);
  const isBusy = archiveMutation.isPending || restoreMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Project settings</h1>
        <p className="mt-1 text-sm text-slate-600">General options, archive state, and admin shortcuts.</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Project type</h2>
        <p className="mt-2 text-sm text-slate-700">
          {project ? PROJECT_TYPE_LABELS[project.projectType] : "Loading…"}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Single-repository projects use one master suite. Baseline projects can add baseline suites that copy the master
          section tree. Multiple-suite projects can add independent suites for separate case catalogs.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Archive</h2>
        <p className="mt-2 text-sm text-slate-600">
          Archived projects stay visible for reporting but block case, run, and result changes until restored.
        </p>
        {isArchived ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
              Archived · read-only
            </span>
            <button
              type="button"
              className="rounded-md border border-emerald-700 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              disabled={isBusy}
              onClick={() => void restoreMutation.mutateAsync()}
            >
              {restoreMutation.isPending ? "Restoring…" : "Restore project"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-4 rounded-md border border-amber-700 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
            disabled={isBusy || !project}
            onClick={() => void archiveMutation.mutateAsync()}
          >
            {archiveMutation.isPending ? "Archiving…" : "Archive project"}
          </button>
        )}
      </section>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Shortcuts</h3>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <Link to={`/projects/${projectId}/settings/tokens`} className="text-slate-700 underline">
              API tokens
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/settings/members`} className="text-slate-700 underline">
              Members & roles
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/settings/custom-roles`} className="text-slate-700 underline">
              Custom roles & permission matrix
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/settings/custom-fields`} className="text-slate-700 underline">
              Custom fields
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/settings/statuses`} className="text-slate-700 underline">
              Custom statuses
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/settings/templates`} className="text-slate-700 underline">
              Case templates
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/settings/webhooks`} className="text-slate-700 underline">
              Webhooks
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/settings/email-outbox`} className="text-slate-700 underline">
              Email outbox
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/settings/defect-integration`} className="text-slate-700 underline">
              Defect integration
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/settings/audit-logs`} className="text-slate-700 underline">
              Audit logs
            </Link>
          </li>
          <li>
            <Link to={`/projects/${projectId}/notifications`} className="text-slate-700 underline">
              Notifications
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
