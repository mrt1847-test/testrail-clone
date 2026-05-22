export const WEBHOOK_MAX_DELIVERY_ATTEMPTS = 8;

const MIN_DISABLE_THRESHOLD = 1;
const MAX_DISABLE_THRESHOLD = 50;

export function getDefaultWebhookDisableThreshold() {
  const raw = Number(process.env.WEBHOOK_DISABLE_FAILURE_THRESHOLD ?? 5);
  if (!Number.isFinite(raw) || raw < MIN_DISABLE_THRESHOLD) return 5;
  return Math.min(Math.floor(raw), MAX_DISABLE_THRESHOLD);
}

export function resolveWebhookDisableThreshold(projectThreshold: number | null | undefined) {
  if (projectThreshold != null && projectThreshold >= MIN_DISABLE_THRESHOLD) {
    return Math.min(Math.floor(projectThreshold), MAX_DISABLE_THRESHOLD);
  }
  return getDefaultWebhookDisableThreshold();
}

export function normalizeProjectWebhookDisableThreshold(value: number | null | undefined) {
  if (value == null) return null;
  const n = Math.floor(value);
  if (n < MIN_DISABLE_THRESHOLD || n > MAX_DISABLE_THRESHOLD) {
    throw new Error(`disableAfterConsecutiveFailures must be between ${MIN_DISABLE_THRESHOLD} and ${MAX_DISABLE_THRESHOLD}`);
  }
  return n;
}

export function getWebhookDeliveryWorkerIntervalMs() {
  const raw = Number(process.env.WEBHOOK_DELIVERY_INTERVAL_MS ?? 8000);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 8000;
}

export function describeWebhookRetryBackoff(attemptNo: number) {
  const base = 5000 * 2 ** Math.max(0, attemptNo - 1);
  return Math.min(base, 3_600_000);
}

export type WebhookDeliveryPolicyView = {
  disableAfterConsecutiveFailures: number;
  projectDisableThreshold: number | null;
  defaultDisableThreshold: number;
  maxDeliveryAttempts: number;
  retryBackoffSummary: string;
  deliveryWorkerIntervalMs: number;
};

export function buildWebhookDeliveryPolicyView(projectDisableThreshold: number | null | undefined): WebhookDeliveryPolicyView {
  const defaultDisableThreshold = getDefaultWebhookDisableThreshold();
  const projectThreshold =
    projectDisableThreshold != null && projectDisableThreshold >= MIN_DISABLE_THRESHOLD
      ? Math.min(Math.floor(projectDisableThreshold), MAX_DISABLE_THRESHOLD)
      : null;
  return {
    disableAfterConsecutiveFailures: resolveWebhookDisableThreshold(projectThreshold),
    projectDisableThreshold: projectThreshold,
    defaultDisableThreshold,
    maxDeliveryAttempts: WEBHOOK_MAX_DELIVERY_ATTEMPTS,
    retryBackoffSummary: "Exponential backoff from 5s per retry, capped at 1 hour (up to 8 delivery attempts per event).",
    deliveryWorkerIntervalMs: getWebhookDeliveryWorkerIntervalMs()
  };
}
