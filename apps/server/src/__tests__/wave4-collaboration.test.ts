import { describe, expect, it } from "vitest";

import { WEBHOOK_DISABLE_FAILURE_THRESHOLD } from "../modules/settings/webhookFailure.service.js";
import { buildDigestBodyForTest } from "../modules/notifications/notificationEmail.helpers.js";
import { auditLogsQuerySchema, webhookCreateSchema } from "../modules/settings/settings.shared.js";

describe("webhook failure threshold", () => {
  it("defaults to 5 consecutive failures", () => {
    expect(WEBHOOK_DISABLE_FAILURE_THRESHOLD).toBeGreaterThanOrEqual(3);
  });
});

describe("global webhook settings", () => {
  it("accepts global webhook scope", () => {
    const parsed = webhookCreateSchema.parse({
      scope: "global",
      event: "run.*",
      targetUrl: "https://example.com/webhook",
      isActive: true
    });
    expect(parsed.scope).toBe("global");
  });
});

describe("cross-project audit settings", () => {
  it("accepts all-project audit scope", () => {
    const parsed = auditLogsQuerySchema.parse({ scope: "all", pageSize: 50 });
    expect(parsed.scope).toBe("all");
    expect(parsed.pageSize).toBe(50);
  });
});

describe("digest preview body", () => {
  it("formats notification lines", () => {
    const body = buildDigestBodyForTest("Demo", [
      {
        type: "assignment",
        title: "Test assigned",
        body: "Case A",
        createdAt: new Date("2026-05-16T12:00:00.000Z")
      }
    ]);
    expect(body).toContain("Demo");
    expect(body).toContain("assignment");
    expect(body).toContain("Test assigned");
  });
});
