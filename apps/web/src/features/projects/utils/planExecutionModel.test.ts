import { describe, expect, it } from "vitest";

import type { PlanEntryRow } from "../api/planningApi";
import type { RunPlanOverviewItem } from "../../runs/api/runsOverviewApi";
import {
  buildPlanExecutionEntries,
  describeGeneratePreview,
  expectedGeneratedRunCount,
  formatPlanCaseScope
} from "./planExecutionModel";

function entry(partial: Partial<PlanEntryRow> & Pick<PlanEntryRow, "id" | "name">): PlanEntryRow {
  return {
    assignedTo: null,
    refs: null,
    startDate: null,
    dueOn: null,
    includeAll: true,
    includeCaseIds: [],
    excludeCaseIds: [],
    isIncluded: true,
    ...partial
  };
}

function overview(partial: Partial<RunPlanOverviewItem> & Pick<RunPlanOverviewItem, "id" | "name">): RunPlanOverviewItem {
  return {
    type: "run",
    createdAt: "2026-09-19T00:00:00.000Z",
    createdBy: null,
    statusCounts: { passed: 0, failed: 0, blocked: 0, retest: 0, untested: 0 },
    percentPassed: 0,
    percentComplete: 0,
    totalTests: 0,
    editPath: `runs/${partial.id}`,
    viewPath: `runs/${partial.id}`,
    ...partial
  };
}

describe("plan execution model", () => {
  it("keeps ungenerated entries distinct from an untested generated run", () => {
    const rows = buildPlanExecutionEntries({
      projectId: "1",
      entries: [
        entry({ id: "e1", name: "Checkout", environment: "Chrome" }),
        entry({ id: "e2", name: "Login", environment: "Firefox", runId: "9" })
      ],
      runs: [{ id: "9", name: "Release — Login", status: "open", progress: 0, failed: 0, createdAt: "-" }],
      overviewItems: [
        overview({
          id: "9",
          name: "Release — Login",
          totalTests: 2,
          percentPassed: 0,
          statusCounts: { untested: 2 }
        })
      ],
      configurationsByEntryId: new Map()
    });
    expect(rows[0]?.run).toBeNull();
    expect(rows[0]?.configurationNames).toEqual(["Chrome"]);
    expect(rows[1]?.run).toEqual(
      expect.objectContaining({
        runId: "9",
        href: "/projects/1/runs/9",
        totalTests: 2,
        untested: 2
      })
    );
  });

  it("previews one run for an ungenerated entry and does not invent extra cartesian runs", () => {
    expect(expectedGeneratedRunCount(false)).toBe(1);
    expect(expectedGeneratedRunCount(true)).toBe(0);
    expect(describeGeneratePreview({ entryName: "Checkout", configurationNames: ["Chrome"], hasRun: false })).toBe(
      "1 run for Checkout (Chrome)."
    );
    expect(describeGeneratePreview({ entryName: "Checkout", configurationNames: ["Chrome"], hasRun: true })).toContain(
      "already has a run"
    );
    expect(formatPlanCaseScope(entry({ id: "e1", name: "Checkout" }))).toBe("All cases");
  });
});
