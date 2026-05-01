import { describe, expect, it } from "vitest";

import {
  latestByCreatedAt,
  toCoverageStatus,
  toRunSummaryMetrics,
  toStatusCounters,
  toUniqueDefectKeys
} from "./reportMetrics.service.js";

describe("reportMetrics.service", () => {
  it("counts known statuses only", () => {
    const counters = toStatusCounters(["passed", "failed", "failed", "custom"]);
    expect(counters).toEqual({
      passed: 1,
      failed: 2,
      blocked: 0,
      retest: 0,
      untested: 0
    });
  });

  it("builds run summary metrics", () => {
    const metrics = toRunSummaryMetrics(["passed", "failed", "untested", "blocked"]);
    expect(metrics).toEqual({
      total: 4,
      passed: 1,
      failed: 1,
      progress: 75
    });
  });

  it("derives coverage status", () => {
    expect(toCoverageStatus([], 0)).toBe("uncovered");
    expect(toCoverageStatus(["untested"], 1)).toBe("untested");
    expect(toCoverageStatus(["passed", "untested"], 2)).toBe("covered");
    expect(toCoverageStatus(["retest"], 1)).toBe("at_risk");
  });

  it("picks latest item by createdAt", () => {
    const latest = latestByCreatedAt([
      { id: "a", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      null,
      { id: "b", createdAt: new Date("2026-01-02T00:00:00.000Z") }
    ]);
    expect(latest?.id).toBe("b");
  });

  it("extracts unique defect keys from at-risk results", () => {
    const keys = toUniqueDefectKeys([
      { status: "passed", defectLinks: [{ defectKey: "P-1" }] },
      { status: "failed", defectLinks: [{ defectKey: "  BUG-1 " }, { defectKey: "BUG-1" }] },
      { status: "blocked", defectLinks: [{ defectKey: "BUG-2" }, { defectKey: "" }] }
    ]);
    expect(keys).toEqual(["BUG-1", "BUG-2"]);
  });
});
