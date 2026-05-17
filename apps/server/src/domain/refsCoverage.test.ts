import { describe, expect, it } from "vitest";

import { buildRefsCoverageReport } from "./refsCoverage.js";

describe("buildRefsCoverageReport", () => {
  it("rolls up reference keys with coverage status", () => {
    const report = buildRefsCoverageReport(
      [
        { refKey: "REQ-1", caseId: "1", caseTitle: "Login", latestStatus: "passed" },
        { refKey: "REQ-1", caseId: "2", caseTitle: "Logout", latestStatus: "failed" },
        { refKey: "REQ-2", caseId: "3", caseTitle: "Search", latestStatus: "untested" }
      ],
      { casesWithRefs: 3, casesWithoutRefs: 1 }
    );

    expect(report.totalReferences).toBe(2);
    expect(report.items.find((row) => row.refKey === "REQ-1")).toMatchObject({
      linkedCaseCount: 2,
      coverageStatus: "at_risk"
    });
    expect(report.casesWithoutRefs).toBe(1);
  });
});
