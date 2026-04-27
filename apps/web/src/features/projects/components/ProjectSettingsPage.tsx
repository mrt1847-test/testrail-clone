import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";

export function ProjectSettingsPage() {
  const { projectId = "" } = useParams();
  return (
    <div className="space-y-6">
      <EmptyState
        title="Project settings"
        description="General project options and danger zone will live here."
      />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Shortcuts</h3>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <Link to={`/projects/${projectId}/settings/tokens`} className="text-slate-700 underline">
              API tokens
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
