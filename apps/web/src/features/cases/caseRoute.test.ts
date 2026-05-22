import { describe, expect, it } from "vitest";

import { buildCaseListPath, buildCaseRepositoryPath } from "./caseRoute";

describe("buildCaseListPath", () => {
  it("builds list path with section and case", () => {
    expect(buildCaseListPath("p1", { sectionId: 3, panelCaseId: 12, panelMode: "edit" })).toBe(
      "/projects/p1/cases?sectionId=3&panelCaseId=12&panelMode=edit"
    );
  });

  it("supports legacy section-only argument", () => {
    expect(buildCaseListPath("p1", 7)).toBe("/projects/p1/cases?sectionId=7");
  });
});

describe("buildCaseRepositoryPath", () => {
  it("serializes full repository query state", () => {
    const params = new URLSearchParams("q=login&focusCaseId=5&panelCaseId=5");
    expect(buildCaseRepositoryPath("p1", params)).toBe("/projects/p1/cases?q=login&focusCaseId=5&panelCaseId=5");
  });
});
