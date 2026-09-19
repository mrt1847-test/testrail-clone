import { describe, expect, it } from "vitest";

import {
  describeRunListFilters,
  filterRunListOpenItems,
  formatRunListKind,
  formatRunListWorkSummary,
  parseRunListScope,
  runListSessionKey
} from "./runListHubModel";
import type { RunPlanOverviewItem } from "../api/runsOverviewApi";

function item(partial: Partial<RunPlanOverviewItem> & Pick<RunPlanOverviewItem, "id" | "type" | "name">): RunPlanOverviewItem {
  return {
    createdAt: "2026-09-19T00:00:00.000Z",
    createdBy: null,
    statusCounts: { passed: 0, failed: 0, blocked: 0, retest: 0, untested: 0 },
    percentPassed: 0,
    percentComplete: 0,
    totalTests: 0,
    editPath: `${partial.type}s/${partial.id}`,
    viewPath: `${partial.type}s/${partial.id}`,
    ...partial
  };
}

describe("run list hub model", () => {
  it("keeps the mixed list as the default and scopes to runs or plans when asked", () => {
    expect(parseRunListScope(null)).toBe("all");
    const rows = [
      item({ id: "1", type: "run", name: "Alpha" }),
      item({ id: "9", type: "plan", name: "Release" })
    ];
    expect(filterRunListOpenItems(rows, "all").map((row) => row.type)).toEqual(["run", "plan"]);
    expect(filterRunListOpenItems(rows, "runs").map((row) => row.id)).toEqual(["1"]);
    expect(filterRunListOpenItems(rows, "plans").map((row) => row.id)).toEqual(["9"]);
  });

  it("names row kind and remaining work from existing overview totals", () => {
    expect(formatRunListKind("run")).toBe("Run");
    expect(formatRunListKind("plan")).toBe("Plan");
    expect(formatRunListWorkSummary({ totalTests: 2, statusCounts: { untested: 1 } })).toBe("2 tests · 1 untested");
    expect(formatRunListWorkSummary({ totalTests: 2, statusCounts: { untested: 0 } })).toBe("2 tests");
    expect(formatRunListWorkSummary({ totalTests: 0, statusCounts: {} })).toBe("No tests yet");
  });

  it("surfaces the filters a tester applied so completed work is not silently implied", () => {
    expect(describeRunListFilters({ scope: "all", mine: false })).toEqual([]);
    expect(describeRunListFilters({ scope: "plans", mine: true, resultStatus: "untested" })).toEqual([
      "Plans",
      "Assigned to me",
      "untested coverage"
    ]);
  });

  it("keys last list filters per project so returning to the hub can restore them", () => {
    expect(runListSessionKey("1")).toBe("testrail.lastView.runs.1");
  });
});
