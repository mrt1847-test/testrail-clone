import { describe, expect, it } from "vitest";

import { buildRunProgressMetrics } from "./runProgress.js";

describe("runProgress", () => {
  it("treats any non-untested status as executed for completion", () => {
    const metrics = buildRunProgressMetrics(["passed", "failed", "blocked", "retest", "untested"]);
    expect(metrics.total).toBe(5);
    expect(metrics.executed).toBe(4);
    expect(metrics.completionRate).toBe(0.8);
    expect(metrics.progressPercent).toBe(80);
  });

  it("returns zero completion for empty runs", () => {
    const metrics = buildRunProgressMetrics([]);
    expect(metrics.total).toBe(0);
    expect(metrics.executed).toBe(0);
    expect(metrics.completionRate).toBe(0);
    expect(metrics.progressPercent).toBe(0);
  });
});
