import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  fetchDigestPreview,
  fetchEmailOutbox,
  retryEmailOutbox,
  type EmailOutboxQuery
} from "../api/settingsApi";

export function EmailOutboxPage() {
  const { projectId = "" } = useParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"" | "pending" | "sent" | "failed">("");
  const [kind, setKind] = useState<"" | "immediate" | "digest">("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const query: EmailOutboxQuery = useMemo(
    () => ({
      page,
      pageSize: 25,
      status: status || undefined,
      kind: kind || undefined,
      recipientEmail: recipientEmail.trim() || undefined
    }),
    [kind, page, recipientEmail, status]
  );

  const outboxKey = useMemo(() => ["email-outbox", projectId, query], [projectId, query]);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: outboxKey,
    queryFn: () => fetchEmailOutbox(projectId, query),
    enabled: Boolean(projectId)
  });

  const digestQuery = useQuery({
    queryKey: ["email-digest-preview", projectId],
    queryFn: () => fetchDigestPreview(projectId),
    enabled: Boolean(projectId)
  });

  const retryMutation = useMutation({
    mutationFn: (outboxId: string) => retryEmailOutbox(projectId, outboxId),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: outboxKey });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Retry failed")
  });

  if (isLoading) return <LoadingState message="Loading email outbox..." />;
  if (isError) return <ErrorState title="Could not load email outbox" onRetry={() => refetch()} />;

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Email outbox</h1>
        <p className="text-sm text-slate-600">Monitor queued emails, retries, and digest preview for your account.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Digest preview</h2>
        {digestQuery.isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading preview...</p>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-slate-500">
              {digestQuery.data?.digestEnabled ? "Digest enabled" : "Digest disabled"} ·{" "}
              {digestQuery.data?.notificationCount ?? 0} pending notification(s) ·{" "}
              {digestQuery.data?.recipientEmail ?? "no email"}
            </p>
            <pre className="max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap">
              {digestQuery.data?.bodyText?.trim() || "(empty — no notifications since last digest)"}
            </pre>
          </div>
        )}
      </div>

      <form
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void refetch();
        }}
      >
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Status</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Kind</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="">All</option>
            <option value="immediate">Immediate</option>
            <option value="digest">Digest</option>
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="text-xs font-medium uppercase text-slate-500">Recipient</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            placeholder="filter by email"
          />
        </label>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Recipient</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Attempts</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No outbox rows match filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.recipientEmail}</td>
                  <td className="px-3 py-2">{row.kind}</td>
                  <td className="max-w-xs truncate px-3 py-2" title={row.subject}>
                    {row.subject}
                  </td>
                  <td className="px-3 py-2">
                    <span className={row.status === "failed" ? "text-red-700" : "text-slate-700"}>{row.status}</span>
                    {row.error ? <p className="text-xs text-red-600">{row.error}</p> : null}
                  </td>
                  <td className="px-3 py-2">{row.attemptNo}</td>
                  <td className="px-3 py-2 text-right">
                    {row.status !== "sent" ? (
                      <button
                        type="button"
                        disabled={retryMutation.isPending}
                        className="text-sm font-medium text-slate-700 underline disabled:opacity-50"
                        onClick={() => retryMutation.mutate(row.id)}
                      >
                        Retry
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <p>
          Page {data?.page ?? 1} of {data?.totalPages ?? 1} · {data?.total ?? 0} total
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-50"
            disabled={page >= (data?.totalPages ?? 1)}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
