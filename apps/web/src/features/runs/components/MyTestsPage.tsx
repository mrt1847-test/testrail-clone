import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useAssignedToMeQuery } from "../hooks/useRunsApi";

export function MyTestsPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useAssignedToMeQuery(projectId);

  if (isLoading) return <LoadingState message="Loading assigned tests…" />;
  if (isError) return <ErrorState title="Could not load assigned tests" onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No assigned tests" description="Tests assigned to you will appear here." />;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Assigned to me</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {data.map((row) => (
          <li key={row.testId} className="rounded border border-slate-200 px-3 py-2">
            <p className="font-medium text-slate-800">
              C{row.caseId} · {row.title}
            </p>
            <p className="text-xs text-slate-500">
              status: {row.status} · run:{" "}
              <Link to={`/projects/${projectId}/runs/${row.runId}`} className="underline">
                {row.runName}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
