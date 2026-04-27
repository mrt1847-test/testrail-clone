import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchCustomFields } from "../api/advancedApi";

export function CustomFieldsPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["custom-fields", projectId],
    queryFn: () => fetchCustomFields(projectId),
    enabled: Boolean(projectId)
  });

  if (isLoading) return <LoadingState message="Loading custom fields…" />;
  if (isError) return <ErrorState title="Could not load custom fields" onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No custom fields" description="Create project-specific fields later." />;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Custom Fields</h2>
      <p className="mt-1 text-xs text-slate-500">Read-only view for now. Mutation UI is intentionally hidden.</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-800">
        {data.map((row) => (
          <li key={row.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
            <span>{row.name}</span>
            <span className="text-xs text-slate-500">{row.fieldType}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
