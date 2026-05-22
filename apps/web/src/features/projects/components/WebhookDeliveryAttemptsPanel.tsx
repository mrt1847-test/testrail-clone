import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { copyTextToClipboard } from "../../../shared/utils/clipboard";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  fetchWebhookAttemptDetail,
  fetchWebhookAttempts,
  retryWebhookAttempt,
  type WebhookAttemptRow,
  type WebhookRow
} from "../api/advancedApi";

function formatWhen(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function AttemptDetail({ projectId, attemptId }: { projectId: string; attemptId: string }) {
  const detailQuery = useQuery({
    queryKey: ["webhook-attempt-detail", projectId, attemptId],
    queryFn: () => fetchWebhookAttemptDetail(projectId, attemptId),
    enabled: Boolean(projectId && attemptId)
  });

  if (detailQuery.isLoading) return <p className="text-xs text-slate-500">Loading diagnostics...</p>;
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <p className="text-xs text-red-700">
        Could not load attempt detail.{" "}
        <button type="button" className="underline" onClick={() => detailQuery.refetch()}>
          Retry
        </button>
      </p>
    );
  }

  const detail = detailQuery.data;
  const payloadJson = detail.payload ? JSON.stringify(detail.payload, null, 2) : null;

  return (
    <div className="space-y-3 text-xs">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="font-semibold text-slate-600">HTTP status</span>
          <p className="font-mono text-slate-900 dark:text-slate-100">{detail.responseStatus ?? "—"}</p>
        </div>
        <div>
          <span className="font-semibold text-slate-600">Next retry</span>
          <p>{formatWhen(detail.nextRetryAt)}</p>
        </div>
        <div>
          <span className="font-semibold text-slate-600">Delivered at</span>
          <p>{formatWhen(detail.deliveredAt)}</p>
        </div>
        <div>
          <span className="font-semibold text-slate-600">Updated</span>
          <p>{formatWhen(detail.updatedAt)}</p>
        </div>
      </div>
      {detail.error ? (
        <div>
          <span className="font-semibold text-slate-600">Error</span>
          <pre className="mt-1 overflow-auto rounded border border-red-200 bg-red-50 p-2 font-mono text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {detail.error}
          </pre>
        </div>
      ) : null}
      {detail.responseBody ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-600">Response body</span>
            <button
              type="button"
              className="text-indigo-700 underline dark:text-indigo-300"
              onClick={() => void copyTextToClipboard(detail.responseBody ?? "")}
            >
              Copy
            </button>
          </div>
          <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-white p-2 font-mono text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
            {detail.responseBody}
          </pre>
        </div>
      ) : null}
      {payloadJson ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-600">Request payload</span>
            <button
              type="button"
              className="text-indigo-700 underline dark:text-indigo-300"
              onClick={() => void copyTextToClipboard(payloadJson)}
            >
              Copy
            </button>
          </div>
          <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-200 bg-white p-2 font-mono text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
            {payloadJson}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function AttemptRow({
  projectId,
  row,
  onRetry,
  retryPending
}: {
  projectId: string;
  row: WebhookAttemptRow;
  onRetry: (id: string) => void;
  retryPending: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="align-top">
        <td className="px-2 py-2">
          <button type="button" className="font-medium text-slate-800 underline dark:text-slate-200" onClick={() => setOpen((v) => !v)}>
            {open ? "▼" : "▶"} {row.event}
          </button>
        </td>
        <td className="px-2 py-2">
          <span
            className={
              row.status === "delivered"
                ? "text-green-800 dark:text-green-300"
                : row.status === "failed"
                  ? "text-red-800 dark:text-red-300"
                  : "text-amber-800 dark:text-amber-300"
            }
          >
            {row.status}
          </span>
        </td>
        <td className="px-2 py-2">{row.attemptNo}</td>
        <td className="px-2 py-2">{row.responseStatus ?? "—"}</td>
        <td className="px-2 py-2 max-w-[12rem] truncate font-mono text-slate-500" title={row.error ?? undefined}>
          {row.error ?? row.responseBodyPreview ?? "—"}
        </td>
        <td className="px-2 py-2">{formatWhen(row.nextRetryAt)}</td>
        <td className="px-2 py-2">{formatWhen(row.createdAt)}</td>
        <td className="px-2 py-2 text-right">
          {(row.status === "failed" || row.status === "pending") && (
            <button
              type="button"
              disabled={retryPending}
              className="font-medium text-slate-700 underline disabled:opacity-50 dark:text-slate-300"
              onClick={() => onRetry(row.id)}
            >
              Retry
            </button>
          )}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={8} className="bg-slate-50 px-3 py-3 dark:bg-slate-900/60">
            <AttemptDetail projectId={projectId} attemptId={row.id} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

type WebhookDeliveryAttemptsPanelProps = {
  projectId: string;
  webhooks: WebhookRow[];
};

export function WebhookDeliveryAttemptsPanel({ projectId, webhooks }: WebhookDeliveryAttemptsPanelProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"" | "pending" | "delivered" | "failed">("");
  const [webhookFilter, setWebhookFilter] = useState("");

  const query = useMemo(
    () => ({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(webhookFilter ? { webhookId: webhookFilter } : {}),
      page: 1,
      pageSize: 50
    }),
    [statusFilter, webhookFilter]
  );

  const attemptsKey = useMemo(() => ["webhook-attempts", projectId, query], [projectId, query]);

  const attemptsQuery = useQuery({
    queryKey: attemptsKey,
    queryFn: () => fetchWebhookAttempts(projectId, query),
    enabled: Boolean(projectId)
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retryWebhookAttempt(projectId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["webhook-attempts", projectId] });
    }
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        Delivery diagnostics
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Inspect HTTP status, errors, response bodies, retry schedule, and request payloads per delivery attempt.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
        </select>
        <select
          className="min-w-[12rem] rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          value={webhookFilter}
          onChange={(e) => setWebhookFilter(e.target.value)}
        >
          <option value="">All webhooks</option>
          {webhooks.map((hook) => (
            <option key={hook.id} value={hook.id}>
              {hook.event} — {hook.targetUrl}
            </option>
          ))}
        </select>
      </div>
      {attemptsQuery.isLoading ? (
        <div className="mt-3">
          <LoadingState message="Loading delivery attempts..." />
        </div>
      ) : attemptsQuery.isError ? (
        <div className="mt-3">
          <ErrorState title="Could not load delivery attempts" onRetry={() => attemptsQuery.refetch()} />
        </div>
      ) : (attemptsQuery.data?.items.length ?? 0) === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No delivery attempts match the current filters.</p>
      ) : (
        <div className="mt-3 overflow-auto rounded border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-2 py-2">Event</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Attempt</th>
                <th className="px-2 py-2">HTTP</th>
                <th className="px-2 py-2">Error / preview</th>
                <th className="px-2 py-2">Next retry</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(attemptsQuery.data?.items ?? []).map((row) => (
                <AttemptRow
                  key={row.id}
                  projectId={projectId}
                  row={row}
                  retryPending={retryMutation.isPending}
                  onRetry={(id) => retryMutation.mutate(id)}
                />
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-2 py-2 text-xs text-slate-500 dark:border-slate-800">
            Showing {attemptsQuery.data?.items.length ?? 0} of {attemptsQuery.data?.total ?? 0} attempts
          </p>
        </div>
      )}
    </div>
  );
}
