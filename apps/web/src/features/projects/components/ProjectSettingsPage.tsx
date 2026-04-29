import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";

export function ProjectSettingsPage() {
  const { projectId = "" } = useParams();
  return (
    <div className="space-y-6">
      <EmptyState
        title="Project settings"
        description="General project options and danger zone will live here. Some pages are currently read-only."
      />
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
            <Link to={`/projects/${projectId}/settings/webhooks`} className="text-slate-700 underline">
              Webhooks
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
        </ul>
      </div>
    </div>
  );
}
