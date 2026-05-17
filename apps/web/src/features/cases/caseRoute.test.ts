import { describe, expect, it } from "vitest";

import { buildCaseListPath } from "./caseRoute";

describe("buildCaseListPath", () => {
  it("builds list path with section and case", () => {
    expect(buildCaseListPath("p1", { sectionId: 3, caseId: 12, mode: "edit" })).toBe(
      "/projects/p1/cases?sectionId=3&caseId=12&mode=edit"
    );
  });

  it("supports legacy section-only argument", () => {
    expect(buildCaseListPath("p1", 7)).toBe("/projects/p1/cases?sectionId=7");
  });
});
