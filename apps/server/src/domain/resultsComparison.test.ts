import { describe, expect, it } from "vitest";

import { buildResultsComparisonReport } from "./resultsComparison.js";

describe("buildResultsComparisonReport", () => {
  it("flags status changes and run-only cases", () => {
    const report = buildResultsComparisonReport(
      { runId: "1", name: "Run A" },
      { runId: "2", name: "Run B" },
      [
        { caseId: "10", title: "Login", status: "passed", testId: "100" },
        { caseId: "11", title: "Only A", status: "failed", testId: "101" }
      ],
      [
        { caseId: "10", title: "Login", status: "failed", testId: "200" },
        { caseId: "12", title: "Only B", status: "blocked", testId: "201" }
      ]
    );

    expect(report.summary).toMatchObject({
      comparedCaseCount: 3,
      sharedCaseCount: 1,
      changedCount: 1,
      unchangedCount: 0,
      onlyInRunACount: 1,
      onlyInRunBCount: 1
    });
    expect(report.items.find((row) => row.caseId === "10")).toMatchObject({
      changed: true,
      statusA: "passed",
      statusB: "failed"
    });
  });
});
