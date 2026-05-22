import { describe, expect, it } from "vitest";

import { buildAbsoluteShareUrl, buildEntitySharePath, formatEntityDisplayId } from "./entityShare";

describe("entityShare", () => {
  it("uses case code for display id when provided", () => {
    expect(formatEntityDisplayId("case", 12, { caseCode: "C501" })).toBe("C501");
    expect(formatEntityDisplayId("run", 5)).toBe("R5");
  });

  it("builds share paths", () => {
    expect(buildEntitySharePath("p1", "case", 12, { sectionId: 3 })).toBe("/projects/p1/cases/12?sectionId=3");
    expect(buildEntitySharePath("p1", "milestone", "9")).toBe("/projects/p1/milestones/9");
  });

  it("preserves repository list state when listSearchParams provided", () => {
    const list = new URLSearchParams("q=auth&focusCaseId=5&sectionId=2");
    expect(buildEntitySharePath("p1", "case", 12, { listSearchParams: list, sectionId: 2 })).toBe(
      "/projects/p1/cases?q=auth&focusCaseId=5&sectionId=2&panelCaseId=12"
    );
  });

  it("preserves run execution query on run share", () => {
    const list = new URLSearchParams("testId=t1&page=2&status=failed");
    expect(buildEntitySharePath("p1", "run", "r9", { listSearchParams: list })).toBe(
      "/projects/p1/runs/r9?testId=t1&page=2&status=failed"
    );
  });

  it("builds absolute urls", () => {
    expect(buildAbsoluteShareUrl("/projects/p1/runs/2")).toMatch(/\/projects\/p1\/runs\/2$/);
  });
});
