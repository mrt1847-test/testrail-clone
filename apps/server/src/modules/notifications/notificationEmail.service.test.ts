import { describe, expect, it } from "vitest";

import { buildDigestBodyForTest, shouldSendImmediateEmail } from "./notificationEmail.helpers.js";

describe("notificationEmail helpers", () => {
  it("skips immediate email when digest is enabled", () => {
    expect(
      shouldSendImmediateEmail(
        { assignmentEnabled: true, failedResultEnabled: true, mentionEnabled: true, digestEnabled: true },
        "assignment"
      )
    ).toBe(false);
  });

  it("respects per-type notification preferences", () => {
    expect(
      shouldSendImmediateEmail(
        { assignmentEnabled: true, failedResultEnabled: false, mentionEnabled: true, digestEnabled: false },
        "failed_result"
      )
    ).toBe(false);
  });

  it("builds digest body with numbered items", () => {
    const body = buildDigestBodyForTest("Alpha", [
      { type: "assignment", title: "Run assigned", body: "Smoke run", createdAt: new Date("2026-05-16T10:00:00Z") }
    ]);
    expect(body).toContain("Alpha");
    expect(body).toContain("Run assigned");
  });
});
