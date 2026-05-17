import { describe, expect, it } from "vitest";

import { buildProjectExecutionSummary } from "./projectExecutionSummary.js";

describe("buildProjectExecutionSummary", () => {
  it("rolls up runs and execution counters", () => {
    const report = buildProjectExecutionSummary({
      totalCases: 120,
      automationCoveragePct: 40,
      runs: [
        { runId: "1", name: "Sprint A", status: "open", total: 10, passed: 4, failed: 1, progress: 50 },
        { runId: "2", name: "Sprint B", status: "completed", total: 5, passed: 5, failed: 0, progress: 100 }
      ],
      executionStatuses: ["passed", "passed", "failed", "untested", "untested", "passed", "passed", "passed", "passed", "passed", "passed", "passed", "passed", "passed", "passed"]
    });

    expect(report.totalRuns).toBe(2);
    expect(report.activeRuns).toBe(1);
    expect(report.completedRuns).toBe(1);
    expect(report.totalCases).toBe(120);
    expect(report.execution.total).toBe(15);
    expect(report.execution.passed).toBeGreaterThan(0);
    expect(report.runs.map((row) => row.name)).toEqual(["Sprint A", "Sprint B"]);
  });
});
