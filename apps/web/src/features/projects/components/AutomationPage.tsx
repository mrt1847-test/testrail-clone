import { EmptyState } from "../../../shared/ui/EmptyState";
import { Link, useParams } from "react-router-dom";

export function AutomationPage() {
  const { projectId = "" } = useParams();
  return (
    <div className="space-y-4">
      <EmptyState
        title="Automation dashboard"
        description="Mapping table, upload history, and bulk upload detail will connect to automation APIs."
      />
      <p className="text-center text-sm">
        <Link to={`/projects/${projectId}/settings/tokens`} className="text-slate-700 underline">
          API tokens
        </Link>
      </p>
    </div>
  );
}
