import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchWebhookDeliveryPolicy, updateWebhookDeliveryPolicy } from "../api/advancedApi";

type WebhookDeliveryPolicyPanelProps = {
  projectId: string;
};

export function WebhookDeliveryPolicyPanel({ projectId }: WebhookDeliveryPolicyPanelProps) {
  const queryClient = useQueryClient();
  const policyKey = ["webhook-delivery-policy", projectId];
  const [thresholdInput, setThresholdInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const policyQuery = useQuery({
    queryKey: policyKey,
    queryFn: () => fetchWebhookDeliveryPolicy(projectId),
    enabled: Boolean(projectId)
  });

  useEffect(() => {
    if (policyQuery.data) {
      setThresholdInput(String(policyQuery.data.disableAfterConsecutiveFailures));
    }
  }, [policyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const parsed = Number(thresholdInput);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
        throw new Error("Enter an integer between 1 and 50");
      }
      return updateWebhookDeliveryPolicy(projectId, { disableAfterConsecutiveFailures: parsed });
    },
    onSuccess: async () => {
      setMessage("Policy saved");
      await queryClient.invalidateQueries({ queryKey: policyKey });
      await queryClient.invalidateQueries({ queryKey: ["webhooks", projectId] });
      window.setTimeout(() => setMessage(null), 2500);
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Could not save policy")
  });

  const resetMutation = useMutation({
    mutationFn: () => updateWebhookDeliveryPolicy(projectId, { disableAfterConsecutiveFailures: null }),
    onSuccess: async () => {
      setMessage("Reset to server default");
      await queryClient.invalidateQueries({ queryKey: policyKey });
      window.setTimeout(() => setMessage(null), 2500);
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Could not reset policy")
  });

  if (policyQuery.isLoading) return <LoadingState message="Loading delivery policy..." />;
  if (policyQuery.isError || !policyQuery.data) {
    return <ErrorState title="Could not load delivery policy" onRetry={() => policyQuery.refetch()} />;
  }

  const policy = policyQuery.data;
  const usingDefault = policy.projectDisableThreshold == null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        Disable-on-failure policy
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        After a delivery exhausts retries, the webhook&apos;s consecutive failure counter increases. When it reaches the
        threshold below, the subscription is auto-disabled until you re-enable it.
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Max attempts per delivery</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">{policy.maxDeliveryAttempts}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Worker interval</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">{policy.deliveryWorkerIntervalMs} ms</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Retry backoff</dt>
          <dd className="text-slate-800 dark:text-slate-200">{policy.retryBackoffSummary}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Server default threshold</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">{policy.defaultDisableThreshold}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Project override</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">
            {usingDefault ? "None (using default)" : policy.projectDisableThreshold}
          </dd>
        </div>
      </dl>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Disable after consecutive failures</span>
          <input
            type="number"
            min={1}
            max={50}
            className="mt-1 block w-32 rounded border border-slate-300 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {saveMutation.isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          disabled={resetMutation.isPending || usingDefault}
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
          onClick={() => resetMutation.mutate()}
        >
          Use server default
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p> : null}
    </div>
  );
}
