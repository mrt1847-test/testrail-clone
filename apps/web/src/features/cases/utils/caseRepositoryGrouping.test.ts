import { describe, expect, it } from "vitest";

import type { TestCase } from "../types";
import { parseCaseGroupBy, regroupRepositoryCases } from "./caseRepositoryGrouping";

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
