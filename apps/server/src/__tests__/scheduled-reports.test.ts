import { describe, expect, it } from "vitest";

import { createScheduledReportSchema } from "../modules/reports/scheduledReports.schema.js";
import { initialNextRunAt } from "../modules/reports/scheduledReports.service.js";

describe("scheduled reports schema", () => {
  it("requires reportType when savedReportId is omitted", () => {
    expect(() =>
      createScheduledReportSchema.parse({
        name: "Daily",
        intervalMinutes: 1440,
        recipientEmails: ["qa@example.com"]
      })
    ).toThrow();
  });

  it("accepts savedReportId without reportType", () => {
    const parsed = createScheduledReportSchema.parse({
      name: "Weekly",
      savedReportId: "1",
      intervalMinutes: 10_080,
      recipientEmails: ["a@b.com", "c@d.com"]
    });
    expect(parsed.savedReportId).toBe(1n);
  });
});

describe("initialNextRunAt", () => {
  it("schedules in the future", () => {
    const now = Date.now();
    const next = initialNextRunAt(60);
    expect(next.getTime()).toBeGreaterThan(now);
  });
});
