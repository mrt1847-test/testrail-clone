import { describe, expect, it } from "vitest";

import { buildDefectSummaryReport } from "./defectSummary.js";

describe("buildDefectSummaryReport", () => {
  it("aggregates linked defects and unlinked at-risk results", () => {
    const report = buildDefectSummaryReport(
      [
        {
          runId: "1",
          runName: "Run A",
          testId: "10",
          caseId: "100",
          title: "Login",
          latestResult: {
            resultId: "r1",
            status: "failed",
            defectKeys: ["BUG-1"],
            createdAt: "2026-05-01T10:00:00.000Z"
          }
        },
        {
          runId: "1",
          runName: "Run A",
          testId: "11",
          caseId: "101",
          title: "Checkout",
          latestResult: {
            resultId: "r2",
            status: "blocked",
            defectKeys: [],
            createdAt: "2026-05-01T11:00:00.000Z"
          }
        },
        {
          runId: "2",
          runName: "Run B",
          testId: "20",
          caseId: "200",
          title: "Search",
          latestResult: {
            resultId: "r3",
            status: "passed",
            defectKeys: ["BUG-9"],
            createdAt: "2026-05-01T12:00:00.000Z"
          }
        }
      ],
      { type: "run", id: "1", label: "Run A" }
    );

    expect(report.dashboard).toMatchObject({
      runCount: 2,
      testCount: 3,
      atRiskResultCount: 2,
      linkedDefectCount: 1,
      unlinkedAtRiskCount: 1
    });
    expect(report.defects).toEqual([
      expect.objectContaining({ defectKey: "BUG-1", linkedResultCount: 1, failedCount: 1 })
    ]);
    expect(report.unlinkedAtRisk[0]?.title).toBe("Checkout");
    expect(report.runs.find((row) => row.runId === "1")).toMatchObject({
      atRiskResultCount: 2,
      unlinkedAtRiskCount: 1
    });
  });
});
