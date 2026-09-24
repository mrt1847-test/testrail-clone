import { describe, expect, it } from "vitest";

import type { TestCase } from "../types";
import { buildSectionHierarchy, parseCaseGroupBy, regroupRepositoryCases } from "./caseRepositoryGrouping";

function caseStub(overrides: Partial<TestCase> & Pick<TestCase, "id" | "sectionId">): TestCase {
  return {
    caseCode: `C${overrides.id}`,
    title: `Case ${overrides.id}`,
    type: "Functional",
    priority: "Medium",
    automationStatus: "manual",
    estimate: "",
    references: "",
    labels: [],
    automationKey: "",
    preconditions: "",
    expectedResult: "",
    mission: "",
    goals: "",
    aiInput: "",
    aiExpectedOutput: "",
    caseTemplateId: null,
    customValues: {},
    steps: [],
    displayOrder: 0,
    lockVersion: 1,
    updatedAt: "",
    archivedAt: null,
    ...overrides
  };
}

describe("caseRepositoryGrouping", () => {
  it("parses groupBy query values", () => {
    expect(parseCaseGroupBy(null)).toBe("section_id");
    expect(parseCaseGroupBy("priority")).toBe("priority");
    expect(parseCaseGroupBy("bogus")).toBe("section_id");
  });

  it("regroups by priority", () => {
    const groups = regroupRepositoryCases({
      sectionGroups: [
        {
          sectionId: 1,
          sectionName: "A",
          cases: [
            caseStub({ id: 1, sectionId: 1, priority: "High" }),
            caseStub({ id: 2, sectionId: 1, priority: "Low" })
          ]
        }
      ],
      groupBy: "priority",
      sectionDepthById: new Map([[1, 0]])
    });
    expect(groups.map((group) => group.label)).toEqual(["High", "Low"]);
    expect(groups[0]?.cases).toHaveLength(1);
  });
});

const hierarchySections = [
  { id: 10, name: "Commerce", parentSectionId: null, displayOrder: 0 },
  { id: 11, name: "Login", parentSectionId: 10, displayOrder: 0 },
  { id: 12, name: "Recovery", parentSectionId: 11, displayOrder: 0 },
  { id: 20, name: "Account", parentSectionId: null, displayOrder: 1 },
  { id: 21, name: "Login", parentSectionId: 20, displayOrder: 0 }
];
const hierarchyGroups = [
  { key: "section-21", label: "Login", sectionId: 21, cases: [caseStub({ id: 2, sectionId: 21 })] },
  { key: "section-12", label: "Recovery", sectionId: 12, cases: [caseStub({ id: 1, sectionId: 12 })] }
];
describe("repository section hierarchy", () => {
  it("retains empty ancestors in tree order without duplicating cases or conflating Login sections", () => {
    const groups = buildSectionHierarchy(hierarchyGroups, hierarchySections, null);
    expect(groups.map(g => [g.sectionId, g.depth, g.displayLabel])).toEqual([
      [10, 0, "Commerce"], [11, 1, "Login"], [12, 2, "Recovery"], [20, 0, "Account"], [21, 1, "Login"]
    ]);
    expect(groups.filter(g => g.displayLabel === "Login").map(g => g.label)).toEqual(["Commerce / Login", "Account / Login"]);
    expect(groups.flatMap(g => g.cases.map(c => c.id))).toEqual([1, 2]);
  });
  it("starts a subtree at its query root and excludes ancestors outside the scope", () => {
    const groups = buildSectionHierarchy([hierarchyGroups[1]!], hierarchySections, 11);
    expect(groups.map(g => [g.sectionId, g.depth])).toEqual([[11, 0], [12, 1]]);
  });
  it("keeps direct selection at depth zero and does not invent unrelated empty groups", () => {
    const groups = buildSectionHierarchy([hierarchyGroups[1]!], hierarchySections, 12);
    expect(groups.map(g => [g.sectionId, g.depth])).toEqual([[12, 0]]);
    expect(buildSectionHierarchy([], hierarchySections, null)).toEqual([]);
  });
});

it("preserves loaded cases when section metadata has a missing parent or section", () => {
  const groups = buildSectionHierarchy(hierarchyGroups, [hierarchySections[4]!], null);
  expect(groups.flatMap(group => group.cases.map(item => item.id)).sort()).toEqual([1, 2]);
});