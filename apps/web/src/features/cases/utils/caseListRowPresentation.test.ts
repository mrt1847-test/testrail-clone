import { describe, expect, it } from "vitest";

import {
  caseListRowClassName,
  caseListRowMetadataParts,
  caseListRowTitleClassName,
  sectionBlockAddCaseLabel
} from "./caseListRowPresentation";

describe("caseListRowPresentation", () => {
  it("uses the Run reading-selected treatment instead of edit-form chrome", () => {
    expect(caseListRowClassName({ readingSelected: true })).toContain("border-l-slate-900");
    expect(caseListRowClassName({ readingSelected: true })).toContain("bg-slate-100");
    expect(caseListRowClassName({ readingSelected: false })).toContain("border-l-transparent");
    expect(caseListRowTitleClassName(true)).toContain("font-semibold");
    expect(caseListRowTitleClassName(false)).toContain("font-medium");
  });

  it("renders Type and Priority as short text and keeps extra columns optional", () => {
    const item = {
      type: "Functional",
      priority: "High",
      automationStatus: "manual",
      estimate: "5m"
    };
    expect(caseListRowMetadataParts(item, ["type", "priority"])).toEqual([
      { column: "type", value: "Functional" },
      { column: "priority", value: "High" }
    ]);
    expect(caseListRowMetadataParts(item, ["type", "priority", "automation", "estimate"])).toEqual([
      { column: "type", value: "Functional" },
      { column: "priority", value: "High" },
      { column: "automation", value: "manual" },
      { column: "estimate", value: "5m" }
    ]);
  });

  it("names the quiet section Add Case action after the owning path", () => {
    expect(sectionBlockAddCaseLabel("Authentication / Login")).toBe("Add Case to Authentication / Login");
  });
});
