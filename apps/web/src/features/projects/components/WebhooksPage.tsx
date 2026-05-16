import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  createWebhook,
  deleteWebhook,
  fetchWebhookAttempts,
  fetchWebhookEvents,
  fetchWebhooks,
  retryWebhookAttempt,
  testSendWebhook,
  updateWebhook
} from "../api/advancedApi";

export function WebhooksPage() {
  const { projectId = "" } = useParams();
  const queryClient = useQueryClient();
  const webhooksKey = useMemo(() => ["webhooks", projectId], [projectId]);
  const attemptsKey = useMemo(() => ["webhook-attempts", projectId], [projectId]);
  const [scope, setScope] = useState<"project" | "global">("project");
  const [event, setEvent] = useState("*");
  const [targetUrl, setTargetUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: webhooksKey,
    queryFn: () => fetchWebhooks(projectId),
    enabled: Boolean(projectId)
  });
  const eventsQuery = useQuery({
    queryKey: ["webhook-events", projectId],
    queryFn: () => fetchWebhookEvents(projectId),
    enabled: Boolean(projectId)
  });
  const attemptsQuery = useQuery({
    queryKey: attemptsKey,
    queryFn: () => fetchWebhookAttempts(projectId),
    enabled: Boolean(projectId)
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: webhooksKey }),
      queryClient.invalidateQueries({ queryKey: attemptsKey })
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createWebhook(projectId, {
        scope,
        event,
        targetUrl,
        secret: secret.trim() || undefined,
        isActive: true
      }),
    onSuccess: async () => {
      setTargetUrl("");
      setSecret("");
      setError(null);
      await refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not create webhook")
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => updateWebhook(projectId, input.id, { isActive: input.isActive }),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not update webhook")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWebhook(projectId, id),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not delete webhook")
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => retryWebhookAttempt(projectId, id),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not retry webhook attempt")
  });

  const testSendMutation = useMutation({
    mutationFn: (id: string) => testSendWebhook(projectId, id),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Test send failed")
  });

  if (isLoading) return <LoadingState message="Loading webhooks..." />;
  if (isError) return <ErrorState title="Could not load webhooks" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Webhooks</h2>
        <form
          className="mt-3 grid gap-2 md:grid-cols-[140px_160px_1fr_180px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!targetUrl.trim()) {
              setError("Target URL is required");
              return;
            }
            createMutation.mutate();
          }}
        >
          <select
            className="rounded border border-slate-300 px-2 py-2 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value as "project" | "global")}
            title="Webhook scope"
          >
            <option value="project">Project</option>
            <option value="global">Global</option>
          </select>
          <select
            className="rounded border border-slate-300 px-2 py-2 text-sm"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            {(eventsQuery.data ?? ["*"]).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-slate-300 px-2 py-2 text-sm"
            placeholder="https://example.com/webhook"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-2 py-2 text-sm"
            placeholder="secret (optional)"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create"}
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>

      {data.length === 0 ? (
        <EmptyState title="No webhooks" description="Create the first event subscription above." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Secret</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.event}</td>
                  <td className="px-3 py-2 text-slate-600">{row.scope === "global" ? "global" : "project"}</td>
                  <td className="px-3 py-2 text-slate-600">{row.targetUrl}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.secretPrefix ?? "-"}</td>
                  <td className="px-3 py-2">
                    {row.autoDisabled ? (
                      <span className="text-amber-800" title={row.disabledAt ? `Disabled ${row.disabledAt}` : undefined}>
                        auto-disabled ({row.consecutiveFailures ?? 0} failures)
                      </span>
                    ) : row.isActive ? (
                      "active"
                    ) : (
                      "inactive"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={!row.isActive || testSendMutation.isPending}
                      className="mr-3 text-sm font-medium text-indigo-700 underline disabled:opacity-50"
                      onClick={() => testSendMutation.mutate(row.id)}
                    >
                      Test send
                    </button>
                    <button
                      type="button"
                      disabled={updateMutation.isPending}
                      className="mr-3 text-sm font-medium text-slate-700 underline disabled:opacity-50"
                      onClick={() => updateMutation.mutate({ id: row.id, isActive: !row.isActive })}
                    >
                      {row.isActive ? "Disable" : row.autoDisabled ? "Re-enable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      className="text-sm font-medium text-red-700 underline disabled:opacity-50"
                      onClick={() => deleteMutation.mutate(row.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recent delivery attempts</h3>
        {attemptsQuery.isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading attempts...</p>
        ) : (attemptsQuery.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No delivery attempts yet.</p>
        ) : (
          <div className="mt-3 overflow-auto rounded border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 uppercase text-slate-600">
                <tr>
                  <th className="px-2 py-2">Event</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Attempt</th>
                  <th className="px-2 py-2">Signature</th>
                  <th className="px-2 py-2">Created</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(attemptsQuery.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2">{row.event}</td>
                    <td className="px-2 py-2">{row.status}</td>
                    <td className="px-2 py-2">{row.attemptNo}</td>
                    <td className="px-2 py-2 font-mono text-slate-500">{row.signaturePrefix}</td>
                    <td className="px-2 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        disabled={retryMutation.isPending}
                        className="font-medium text-slate-700 underline disabled:opacity-50"
                        onClick={() => retryMutation.mutate(row.id)}
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
