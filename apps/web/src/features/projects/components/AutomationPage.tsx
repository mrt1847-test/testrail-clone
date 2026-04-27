import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchAutomationSummary, fetchAutomationUploads } from "../api/advancedApi";

export function AutomationPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["automation-summary", projectId],
    queryFn: () => fetchAutomationSummary(projectId),
    enabled: Boolean(projectId)
  });
  const uploadsQuery = useQuery({
    queryKey: ["automation-uploads", projectId],
    queryFn: () => fetchAutomationUploads(projectId),
    enabled: Boolean(projectId)
  });

  if (isLoading) return <LoadingState message="Loading automation dashboard…" />;
  if (isError || !data) return <ErrorState title="Could not load automation dashboard" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Automation Summary</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Mapped cases</p>
            <p className="text-xl font-semibold text-slate-900">{data.mappedCases}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Uploads</p>
            <p className="text-xl font-semibold text-slate-900">{data.uploadedRuns}</p>
          </div>
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Last upload</p>
            <p className="text-sm font-medium text-slate-800">{data.lastUploadAt ?? "—"}</p>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recent uploads</h3>
        {uploadsQuery.isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading uploads…</p>
        ) : uploadsQuery.isError ? (
          <p className="mt-2 text-sm text-rose-600">Could not load uploads.</p>
        ) : (uploadsQuery.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No upload history yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {(uploadsQuery.data ?? []).slice(0, 5).map((upload) => (
              <li key={upload.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                <span>
                  #{upload.id} · failed {upload.failed} / {upload.total}
                </span>
                <Link to={`/projects/${projectId}/automation/uploads/${upload.id}`} className="text-slate-700 underline">
                  Detail
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-sm">
        <Link to={`/projects/${projectId}/settings/tokens`} className="text-slate-700 underline">
          API tokens
        </Link>
      </p>
    </div>
  );
}
