import { describe, expect, it } from "vitest";

import { buildMilestoneForecast } from "./milestoneForecast.js";

describe("buildMilestoneForecast", () => {
  const now = new Date("2026-05-17T12:00:00.000Z");

  it("marks completed milestones", () => {
    const forecast = buildMilestoneForecast({
      isCompleted: true,
      lifecycleStatus: "completed",
      startDate: "2026-05-01",
      dueDate: "2026-05-20",
      total: 10,
      passed: 10,
      failed: 0,
      now
    });
    expect(forecast.scheduleStatus).toBe("completed");
    expect(forecast.remainingTests).toBe(0);
  });

  it("requests schedule dates when missing", () => {
    const forecast = buildMilestoneForecast({
      isCompleted: false,
      lifecycleStatus: "open",
      startDate: null,
      dueDate: null,
      total: 20,
      passed: 5,
      failed: 2,
      now
    });
    expect(forecast.scheduleStatus).toBe("no_schedule");
    expect(forecast.hint).toContain("start and due dates");
  });

  it("flags at-risk when projected completion is after due date", () => {
    const forecast = buildMilestoneForecast({
      isCompleted: false,
      lifecycleStatus: "open",
      startDate: "2026-05-01",
      dueDate: "2026-05-20",
      total: 100,
      passed: 10,
      failed: 0,
      now
    });
    expect(forecast.scheduleStatus).toBe("at_risk");
    expect(forecast.projectedOnTime).toBe(false);
    expect(forecast.burndown.length).toBeGreaterThan(0);
  });

  it("marks overdue when past due with remaining work", () => {
    const forecast = buildMilestoneForecast({
      isCompleted: false,
      lifecycleStatus: "open",
      startDate: "2026-04-01",
      dueDate: "2026-05-10",
      total: 10,
      passed: 2,
      failed: 1,
      now
    });
    expect(forecast.scheduleStatus).toBe("overdue");
  });
});
