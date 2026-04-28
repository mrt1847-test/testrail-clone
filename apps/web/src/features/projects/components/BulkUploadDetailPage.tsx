import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchAutomationUploadDetail, retryAutomationUploadFailed } from "../api/advancedApi";

export function BulkUploadDetailPage() {
  const { projectId = "", uploadId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["automation-upload-detail", projectId, uploadId],
    queryFn: () => fetchAutomationUploadDetail(projectId, uploadId),
    enabled: Boolean(projectId && uploadId)
  });
  const retryMutation = useMutation({
    mutationFn: () => retryAutomationUploadFailed(projectId, uploadId)
  });

  if (isLoading) return <LoadingState message="Loading upload detail…" />;
  if (isError || !data) return <ErrorState title="Could not load upload detail" onRetry={() => refetch()} />;
  const failedItems = data.items.filter((item) => item.status === "failed");
  const uploadMeta = data.metadata;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Bulk Upload Summary</h2>
        <p className="mt-2 text-sm text-slate-700">Upload ID: {uploadId}</p>
        <p className="mt-1 text-xs text-slate-500">
          total {data.total} · saved {data.saved} · failed {data.failed} · uploaded {new Date(data.uploadedAt).toLocaleString()}
        </p>
        <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
          <p>External run: {uploadMeta.external_run_id ?? "—"}</p>
          <p>CI provider: {uploadMeta.ci_provider ?? "—"}</p>
          <p>Branch: {uploadMeta.branch ?? "—"}</p>
          <p>Commit: {uploadMeta.commit_sha ?? "—"}</p>
          <p>Build ID: {uploadMeta.ci_build_id ?? "—"}</p>
          <p>Attempt: {uploadMeta.attempt ?? "—"}</p>
        </div>
        {uploadMeta.job_url ? (
          <p className="mt-1 text-xs text-slate-600">
            Job URL:{" "}
            <a href={uploadMeta.job_url} target="_blank" rel="noreferrer" className="underline">
              {uploadMeta.job_url}
            </a>
          </p>
        ) : null}
        <button
          className="mt-3 rounded border border-slate-300 px-2 py-1 text-xs"
          disabled={retryMutation.isPending || failedItems.length === 0}
          onClick={() => void retryMutation.mutateAsync()}
        >
          Retry failed items
        </button>
        {retryMutation.data ? (
          <p className="mt-2 text-xs text-emerald-700">
            Retry requested: queued {retryMutation.data.data.queued}, retried {retryMutation.data.data.retried}
          </p>
        ) : null}
      </div>

      {failedItems.length === 0 ? (
        <EmptyState
          title="No failed items"
          description="All uploaded items were saved successfully."
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Failed items</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {failedItems.map((item) => (
              <li key={item.resultId} className="rounded border border-rose-200 bg-rose-50 px-3 py-2">
                case C{item.caseId} · test {item.testId} · {item.comment ?? "no comment"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
