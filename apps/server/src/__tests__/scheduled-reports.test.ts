import { afterEach, describe, expect, it, vi } from "vitest";

import { createScheduledReportSchema } from "../modules/reports/scheduledReports.schema.js";
import { startScheduledReportWorker } from "../modules/reports/scheduledReport.worker.js";
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

describe("startScheduledReportWorker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a dropped database connection instead of rejecting the tick", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const prisma = {
      scheduledReport: {
        findMany: vi.fn().mockRejectedValue(
          new Error("terminating connection due to administrator command")
        )
      }
    };

    const timer = startScheduledReportWorker({
      prisma: prisma as never,
      intervalMs: 60_000
    });

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    clearInterval(timer);

    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("Scheduled report worker failed");
  });
});
