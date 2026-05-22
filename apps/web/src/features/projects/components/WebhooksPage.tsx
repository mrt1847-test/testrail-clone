import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { Button, DataTable, Panel, useToast, type DataTableColumn } from "../../../shared/ui";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  createWebhook,
  deleteWebhook,
  fetchWebhookEvents,
  fetchWebhooks,
  testSendWebhook,
  updateWebhook,
  type WebhookRow
} from "../api/advancedApi";
import { WebhookDeliveryAttemptsPanel } from "./WebhookDeliveryAttemptsPanel";
import { WebhookDeliveryPolicyPanel } from "./WebhookDeliveryPolicyPanel";
import { WebhookEventCatalogPanel } from "./WebhookEventCatalogPanel";

export function WebhooksPage() {
  const { projectId = "" } = useParams();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const webhooksKey = useMemo(() => ["webhooks", projectId], [projectId]);
  const [scope, setScope] = useState<"project" | "global">("project");
  const [event, setEvent] = useState("*");
  const [targetUrl, setTargetUrl] = useState("");
  const [secret, setSecret] = useState("");

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
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: webhooksKey }),
      queryClient.invalidateQueries({ queryKey: ["webhook-attempts", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["webhook-delivery-policy", projectId] })
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
      showToast("Webhook created", "success");
      await refresh();
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Could not create webhook", "error")
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => updateWebhook(projectId, input.id, { isActive: input.isActive }),
    onSuccess: refresh,
    onError: (e) => showToast(e instanceof Error ? e.message : "Could not update webhook", "error")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWebhook(projectId, id),
    onSuccess: async () => {
      showToast("Webhook deleted", "success");
      await refresh();
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Could not delete webhook", "error")
  });

  const testSendMutation = useMutation({
    mutationFn: (id: string) => testSendWebhook(projectId, id),
    onSuccess: async () => {
      showToast("Test delivery queued", "success");
      await refresh();
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Test send failed", "error")
  });

  const columns = useMemo<DataTableColumn<WebhookRow>[]>(
    () => [
      { key: "event", header: "Event", cell: (row) => <span className="font-medium text-slate-900">{row.event}</span> },
      { key: "scope", header: "Scope", cell: (row) => row.scope ?? "project" },
      { key: "target", header: "Target", cell: (row) => row.targetUrl },
      {
        key: "secret",
        header: "Secret",
        cell: (row) => <span className="font-mono text-xs text-slate-500">{row.secretPrefix ?? "-"}</span>
      },
      {
        key: "status",
        header: "Status",
        cell: (row) =>
          row.autoDisabled ? (
            <span className="text-amber-800" title={row.disabledAt ? `Disabled ${row.disabledAt}` : undefined}>
              auto-disabled ({row.consecutiveFailures ?? 0} failures)
            </span>
          ) : row.isActive ? (
            "active"
          ) : (
            "inactive"
          )
      },
      {
        key: "actions",
        header: "Actions",
        align: "right",
        headerClassName: "text-right",
        cell: (row) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="link"
              size="sm"
              disabled={!row.isActive || testSendMutation.isPending}
              onClick={() => testSendMutation.mutate(row.id)}
            >
              Test send
            </Button>
            <Button
              variant="link"
              size="sm"
              className="!text-slate-700"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: row.id, isActive: !row.isActive })}
            >
              {row.isActive ? "Disable" : row.autoDisabled ? "Re-enable" : "Enable"}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="!text-red-700"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(row.id)}
            >
              Delete
            </Button>
          </div>
        )
      }
    ],
    [deleteMutation.isPending, testSendMutation.isPending, updateMutation.isPending]
  );

  if (isLoading) return <LoadingState message="Loading webhooks..." />;
  if (isError) return <ErrorState title="Could not load webhooks" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <Panel title="Webhooks">
        <form
          className="grid gap-2 md:grid-cols-[140px_160px_1fr_180px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!targetUrl.trim()) {
              showToast("Target URL is required", "error");
              return;
            }
            createMutation.mutate();
          }}
        >
          <select
            className="rounded border border-slate-300 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            value={scope}
            onChange={(e) => setScope(e.target.value as "project" | "global")}
            title="Webhook scope"
          >
            <option value="project">Project</option>
            <option value="global">Global</option>
          </select>
          <select
            className="rounded border border-slate-300 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
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
            className="rounded border border-slate-300 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="https://example.com/webhook"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="secret (optional)"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <Button type="submit" loading={createMutation.isPending}>
            Create
          </Button>
        </form>
      </Panel>

      <WebhookDeliveryPolicyPanel projectId={projectId} />

      {data.length === 0 ? (
        <EmptyState title="No webhooks" description="Create the first event subscription above." />
      ) : (
        <DataTable columns={columns} rows={data} rowKey={(row) => row.id} emptyMessage="No webhooks." />
      )}

      <WebhookDeliveryAttemptsPanel projectId={projectId} webhooks={data} />

      <WebhookEventCatalogPanel projectId={projectId} />
    </div>
  );
}
