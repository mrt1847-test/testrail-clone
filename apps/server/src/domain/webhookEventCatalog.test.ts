import { describe, expect, it } from "vitest";

import { WEBHOOK_EVENTS } from "./webhookEvents.js";
import { buildSampleWebhookBody, buildWebhookEventCatalog } from "./webhookEventCatalog.js";

describe("webhookEventCatalog", () => {
  it("returns one catalog row per subscription pattern", () => {
    const catalog = buildWebhookEventCatalog("7");
    expect(catalog).toHaveLength(WEBHOOK_EVENTS.length);
    expect(catalog.map((row) => row.event)).toEqual([...WEBHOOK_EVENTS]);
  });

  it("uses the activity delivery envelope for samples", () => {
    const body = buildSampleWebhookBody("case.created", "7");
    expect(body).toMatchObject({
      id: expect.any(String),
      projectId: "7",
      entityType: "case",
      eventType: "case.created",
      title: "Test case created",
      payload: { caseId: "501" },
      createdAt: expect.any(String)
    });
  });

  it("resolves wildcard patterns to a concrete example event type", () => {
    const wildcard = buildSampleWebhookBody("run.*", "1");
    expect(wildcard.eventType).toBe("run.updated");
    const all = buildSampleWebhookBody("*", "1");
    expect(all.eventType).toBe("case.updated");
  });

  it("includes signature and event headers on each catalog row", () => {
    const row = buildWebhookEventCatalog("3").find((item) => item.event === "result.failed");
    expect(row?.sampleHeaders["X-Webhook-Event"]).toBe("result.failed");
    expect(row?.sampleHeaders["X-Webhook-Signature"]).toMatch(/^sha256=/);
    expect(row?.samplePayload.projectId).toBe("3");
  });
});
