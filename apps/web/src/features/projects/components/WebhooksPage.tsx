import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchWebhooks } from "../api/advancedApi";

export function WebhooksPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["webhooks", projectId],
    queryFn: () => fetchWebhooks(projectId),
    enabled: Boolean(projectId)
  });

  if (isLoading) return <LoadingState message="Loading webhooks…" />;
  if (isError) return <ErrorState title="Could not load webhooks" onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No webhooks" description="Webhook event subscriptions will appear here." />;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Webhooks</h2>
      <p className="mt-1 text-xs text-slate-500">Read-only view for now. Create/edit/delete will be added later.</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-800">
        {data.map((row) => (
          <li key={row.id} className="rounded border border-slate-200 px-3 py-2">
            <p className="font-medium">{row.event}</p>
            <p className="text-xs text-slate-500">{row.targetUrl}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
