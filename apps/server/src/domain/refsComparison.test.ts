import { describe, expect, it } from "vitest";

import { buildRefsComparisonReport } from "./refsComparison.js";

describe("buildRefsComparisonReport", () => {
  it("aggregates statuses per reference across runs", () => {
    const report = buildRefsComparisonReport(
      { runId: "1", name: "Run A" },
      { runId: "2", name: "Run B" },
      [
        {
          refKey: "REQ-1",
          caseId: "10",
          caseTitle: "Login",
          statusA: "passed",
          statusB: "failed",
          testIdA: "100",
          testIdB: "200"
        }
      ]
    );

    expect(report.summary.changedCount).toBe(1);
    expect(report.items[0]).toMatchObject({
      refKey: "REQ-1",
      statusA: "passed",
      statusB: "failed",
      changed: true
    });
  });
});
