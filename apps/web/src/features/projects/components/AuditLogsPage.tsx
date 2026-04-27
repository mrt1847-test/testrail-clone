import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchAuditLogs } from "../api/advancedApi";

export function AuditLogsPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", projectId],
    queryFn: () => fetchAuditLogs(projectId),
    enabled: Boolean(projectId)
  });

  if (isLoading) return <LoadingState message="Loading audit logs…" />;
  if (isError) return <ErrorState title="Could not load audit logs" onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No audit logs" description="Audit log query results will appear here." />;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Audit Logs</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-800">
        {data.map((row) => (
          <li key={row.id} className="rounded border border-slate-200 px-3 py-2">
            <p className="text-xs font-semibold text-slate-800">{row.action}</p>
            <p className="text-xs text-slate-600">
              {row.entityType}:{row.entityId}
              {row.actorUserId ? ` · actor=${row.actorUserId}` : ""}
              {" · "}
              {new Date(row.createdAt).toLocaleString()}
            </p>
            {row.changes ? (
              <pre className="mt-1 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">
                {JSON.stringify(row.changes, null, 2)}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
