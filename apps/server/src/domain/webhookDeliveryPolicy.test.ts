import { describe, expect, it } from "vitest";

import {
  buildWebhookDeliveryPolicyView,
  resolveWebhookDisableThreshold,
  WEBHOOK_MAX_DELIVERY_ATTEMPTS
} from "./webhookDeliveryPolicy.js";

describe("webhookDeliveryPolicy", () => {
  it("uses project override when set", () => {
    expect(resolveWebhookDisableThreshold(3)).toBe(3);
    expect(resolveWebhookDisableThreshold(null)).toBeGreaterThanOrEqual(1);
  });

  it("builds a policy view with delivery limits", () => {
    const view = buildWebhookDeliveryPolicyView(4);
    expect(view.disableAfterConsecutiveFailures).toBe(4);
    expect(view.projectDisableThreshold).toBe(4);
    expect(view.maxDeliveryAttempts).toBe(WEBHOOK_MAX_DELIVERY_ATTEMPTS);
  });

  it("rejects invalid project thresholds", () => {
    expect(() => resolveWebhookDisableThreshold(0)).not.toThrow();
    expect(resolveWebhookDisableThreshold(0)).toBeGreaterThanOrEqual(1);
  });
});
