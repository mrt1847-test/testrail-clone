import { describe, expect, it } from "vitest";

import type { TestCase } from "../types";
import { regroupRepositoryCases } from "./caseRepositoryGrouping";
import {
  applySectionPathLabels,
  collapsedHiddenSelectedCount,
  collapseAllGroupKeys,
  expandAllGroupKeys,
  sectionBlockToggleLabel,
  shouldShowCaseGroupHeaders,
  toggleCollapsedGroupKey
} from "./caseListSectionBlocks";

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

const sections = [
  { id: 2, name: "Authentication", parentSectionId: null, displayOrder: 1 },
  { id: 3, name: "Login", parentSectionId: 2, displayOrder: 1 },
  { id: 4, name: "MFA", parentSectionId: 3, displayOrder: 1 },
  { id: 5, name: "Billing", parentSectionId: null, displayOrder: 2 },
  { id: 6, name: "Login", parentSectionId: 5, displayOrder: 1 }
];

describe("shouldShowCaseGroupHeaders", () => {
  it("keeps owning-section headers visible in compact display", () => {
    expect(shouldShowCaseGroupHeaders("section_id", "compact")).toBe(true);
    expect(shouldShowCaseGroupHeaders("section_id", "subtree")).toBe(true);
    expect(shouldShowCaseGroupHeaders("none", "compact")).toBe(false);
  });
});

describe("applySectionPathLabels", () => {
  it("distinguishes duplicate section names with ancestry paths", () => {
    const groups = regroupRepositoryCases({
      sectionGroups: [
        { sectionId: 3, sectionName: "Login", cases: [caseStub({ id: 1, sectionId: 3 })] },
        { sectionId: 6, sectionName: "Login", cases: [caseStub({ id: 2, sectionId: 6 })] }
      ],
      groupBy: "section_id",
      sectionDepthById: new Map([
        [3, 1],
        [6, 1]
      ])
    });
    expect(groups.map((group) => group.label)).toEqual(["Login", "Login"]);
    expect(applySectionPathLabels(groups, sections).map((group) => group.label)).toEqual([
      "Authentication / Login",
      "Billing / Login"
    ]);
  });

  it("keeps three-level nesting readable without duplicating cases", () => {
    const groups = applySectionPathLabels(
      regroupRepositoryCases({
        sectionGroups: [
          { sectionId: 2, sectionName: "Authentication", cases: [caseStub({ id: 1, sectionId: 2 })] },
          {
            sectionId: 3,
            sectionName: "Login",
            cases: [caseStub({ id: 2, sectionId: 3 }), caseStub({ id: 3, sectionId: 3 })]
          },
          { sectionId: 4, sectionName: "MFA", cases: [caseStub({ id: 4, sectionId: 4 })] }
        ],
        groupBy: "section_id",
        sectionDepthById: new Map([
          [2, 0],
          [3, 1],
          [4, 2]
        ])
      }),
      sections
    );
    expect(groups.map((group) => [group.label, group.cases.length])).toEqual([
      ["Authentication", 1],
      ["Authentication / Login", 2],
      ["Authentication / Login / MFA", 1]
    ]);
    expect(groups.flatMap((group) => group.cases.map((item) => item.id))).toEqual([1, 2, 3, 4]);
  });
});

describe("section block collapse", () => {
  it("toggles visibility only and reports selected cases hidden in a collapsed block", () => {
    const keys = ["section-2", "section-3", "section-4"];
    const collapsed = collapseAllGroupKeys(keys);
    expect(collapsed.size).toBe(3);
    expect(toggleCollapsedGroupKey(collapsed, "section-3").has("section-3")).toBe(false);
    expect(expandAllGroupKeys().size).toBe(0);
    expect(collapsedHiddenSelectedCount(true, new Set([2, 9]), [1, 2, 3])).toBe(1);
    expect(collapsedHiddenSelectedCount(false, new Set([2]), [1, 2, 3])).toBe(0);
    expect(sectionBlockToggleLabel("Authentication / Login", true)).toBe("Expand Authentication / Login");
  });
});
