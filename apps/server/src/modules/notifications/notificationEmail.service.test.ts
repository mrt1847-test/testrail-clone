import { describe, expect, it } from "vitest";

import {
  buildDigestBodyForTest,
  buildImmediateEmailBody,
  buildNotificationActionUrl,
  shouldSendImmediateEmail
} from "./notificationEmail.helpers.js";

describe("notificationEmail helpers", () => {
  it("skips immediate email when digest is enabled", () => {
    expect(
      shouldSendImmediateEmail(
        {
          assignmentEnabled: true,
          failedResultEnabled: true,
          activityEnabled: true,
          mentionEnabled: true,
          digestEnabled: true
        },
        "assignment"
      )
    ).toBe(false);
  });

  it("respects per-type notification preferences", () => {
    expect(
      shouldSendImmediateEmail(
        {
          assignmentEnabled: true,
          failedResultEnabled: false,
          activityEnabled: true,
          mentionEnabled: true,
          digestEnabled: false
        },
        "failed_result"
      )
    ).toBe(false);
  });

  it("respects activity preference for assigned-test updates", () => {
    expect(
      shouldSendImmediateEmail(
        {
          assignmentEnabled: true,
          failedResultEnabled: true,
          activityEnabled: false,
          mentionEnabled: true,
          digestEnabled: false
        },
        "activity"
      )
    ).toBe(false);
  });

  it("builds assignment email deep links to the assigned test", () => {
    const url = buildNotificationActionUrl("http://localhost:5173", "42", "assignment", {
      runId: "9",
      testId: "100"
    });
    expect(url).toBe("http://localhost:5173/projects/42/runs/9?testId=100");
  });

  it("appends action url to immediate email body", () => {
    const body = buildImmediateEmailBody(
      { type: "assignment", title: "You were assigned a test", body: "Login · Smoke" },
      "Alpha",
      "http://localhost:5173/projects/1/my-tests"
    );
    expect(body).toContain("Open: http://localhost:5173/projects/1/my-tests");
  });

  it("builds digest body with numbered items", () => {
    const body = buildDigestBodyForTest("Alpha", [
      { type: "assignment", title: "Run assigned", body: "Smoke run", createdAt: new Date("2026-05-16T10:00:00Z") }
    ]);
    expect(body).toContain("Alpha");
    expect(body).toContain("Run assigned");
  });
});
