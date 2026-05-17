import { describe, expect, it } from "vitest";

import { buildRefsDefectSummaryReport } from "./refsDefectSummary.js";

describe("buildRefsDefectSummaryReport", () => {
  it("rolls up defect coverage per reference key", () => {
    const report = buildRefsDefectSummaryReport([
      {
        refKey: "REQ-1",
        caseId: "1",
        caseTitle: "Login",
        latestStatus: "failed",
        defectKeys: ["BUG-1"]
      },
      {
        refKey: "REQ-1",
        caseId: "2",
        caseTitle: "Logout",
        latestStatus: "passed",
        defectKeys: []
      },
      {
        refKey: "REQ-2",
        caseId: "3",
        caseTitle: "Search",
        latestStatus: "failed",
        defectKeys: []
      },
      {
        refKey: "REQ-3",
        caseId: "4",
        caseTitle: "Browse",
        latestStatus: "passed",
        defectKeys: []
      }
    ]);

    expect(report.totalReferences).toBe(3);
    expect(report.items.find((row) => row.refKey === "REQ-1")).toMatchObject({
      linkedCaseCount: 2,
      atRiskResultCount: 1,
      linkedDefectCount: 1,
      defectCoverage: "linked",
      defectKeys: ["BUG-1"]
    });
    expect(report.items.find((row) => row.refKey === "REQ-2")).toMatchObject({
      atRiskResultCount: 1,
      linkedDefectCount: 0,
      defectCoverage: "unlinked"
    });
    expect(report.items.find((row) => row.refKey === "REQ-3")).toMatchObject({
      defectCoverage: "not_applicable"
    });
  });
});
