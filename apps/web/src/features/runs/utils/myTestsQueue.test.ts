import { describe, expect, it } from "vitest";

import type { AssignedTestRow } from "../api/runApi";
import { flattenMyTestsQueue, myTestsResultPath } from "./myTestsQueue";

function row(partial: Partial<AssignedTestRow> & Pick<AssignedTestRow, "testId" | "status" | "agingLevel">): AssignedTestRow {
  return {
    runId: "1",
    runName: "Run",
    caseId: partial.testId,
    title: `Case ${partial.testId}`,
    assignedTo: "u1",
    runDueOn: null,
    milestoneId: null,
    milestoneName: null,
    ...partial
  };
}

describe("flattenMyTestsQueue", () => {
  it("orders overdue and follow-up work ahead of untested and completed assignments", () => {
    const ordered = flattenMyTestsQueue([
      row({ testId: "passed", status: "passed", agingLevel: "none" }),
      row({ testId: "fresh", status: "untested", agingLevel: "none" }),
      row({ testId: "late", status: "untested", agingLevel: "overdue" }),
      row({ testId: "fail", status: "failed", agingLevel: "none" })
    ]);
    expect(ordered.map((item) => item.testId)).toEqual(["late", "fail", "fresh", "passed"]);
    expect(ordered.map((item) => item.queueLabel)).toEqual([
      "Overdue",
      "Failed, blocked, or retest",
      "Untested",
      "Other assignments"
    ]);
  });

  it("points Add result at the run execution composer for that test", () => {
    expect(myTestsResultPath("9", { runId: "4", testId: "12" })).toBe("/projects/9/runs/4?testId=12");
  });
});
