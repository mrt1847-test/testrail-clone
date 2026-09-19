import { describe, expect, it } from "vitest";

import type { AssignedTestRow } from "../api/runApi";
import {
  flattenMyTestsQueue,
  formatMyTestsDueContext,
  formatMyTestsMatchCount,
  formatMyTestsRunContext,
  myTestsResultPath,
  setMyTestsSelection,
  visibleMyTestsSelection
} from "./myTestsQueue";

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

  it("points Open test at the run execution reading panel for that test", () => {
    expect(myTestsResultPath("9", { runId: "4", testId: "12" })).toBe("/projects/9/runs/4?testId=12");
  });
});

describe("My Tests identity and selection", () => {
  it("keeps a short run identifier that distinguishes the same case in two runs", () => {
    expect(formatMyTestsRunContext({ runId: "1", runName: "Alpha regression" })).toBe("R1 Alpha regression");
    expect(formatMyTestsRunContext({ runId: "2", runName: "Beta smoke" })).toBe("R2 Beta smoke");
    expect(formatMyTestsRunContext({ runId: "8", runName: "R8 Nightly" })).toBe("R8 Nightly");
  });

  it("selects one test at a time instead of a bulk recording set", () => {
    expect(setMyTestsSelection(null, "1", true)).toBe("1");
    expect(setMyTestsSelection("1", "3", true)).toBe("3");
    expect(setMyTestsSelection("3", "3", false)).toBeNull();
  });

  it("drops a selected test that filters hide instead of keeping a hidden target", () => {
    expect(visibleMyTestsSelection("3", ["1", "2"])).toBeNull();
    expect(visibleMyTestsSelection("3", ["1", "3"])).toBe("3");
  });
});

describe("My Tests queue presentation", () => {
  it("names the visible match count without implying a hidden default filter", () => {
    expect(formatMyTestsMatchCount(3, 3)).toBe("3 assigned tests");
    expect(formatMyTestsMatchCount(1, 3)).toBe("1 of 3 assigned tests");
    expect(formatMyTestsMatchCount(1, 1)).toBe("1 assigned test");
  });

  it("keeps due context on the row when a run due date exists", () => {
    expect(formatMyTestsDueContext({ runDueOn: "2026-09-17T00:00:00.000Z", agingLevel: "overdue" })).toMatch(
      /Due .+ · Overdue/
    );
    expect(formatMyTestsDueContext({ runDueOn: null, agingLevel: "none" })).toBe("");
  });
});
