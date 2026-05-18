import { describe, expect, it } from "vitest";

import { buildSuiteCaseGroups } from "./suiteCaseGrouping.js";

describe("buildSuiteCaseGroups", () => {
  it("groups by priority with stable ordering", () => {
    const cases = [
      { sectionId: 1n, priority: "Low", caseType: "Functional" },
      { sectionId: 1n, priority: "High", caseType: "Functional" }
    ];
    const result = buildSuiteCaseGroups(cases, [], "priority");
    expect(result.groupBy).toBe("priority");
    expect(result.groups.map((group) => group.groupLabel)).toEqual(["High", "Low"]);
  });

  it("groups by section in tree order", () => {
    const sections = [
      { id: 2n, name: "Child", displayOrder: 0, parentSectionId: 1n },
      { id: 1n, name: "Root", displayOrder: 0, parentSectionId: null }
    ];
    const cases = [
      { sectionId: 2n, priority: "High", caseType: "Functional" },
      { sectionId: 1n, priority: "Low", caseType: "Functional" }
    ];
    const result = buildSuiteCaseGroups(cases, sections, "section_id");
    expect(result.groups.map((group) => group.groupLabel)).toEqual(["Root", "Child"]);
  });
});
