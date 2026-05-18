import { describe, expect, it } from "vitest";

import { buildRunInstanceGroups } from "./runInstanceGrouping.js";
import type { TestInstance } from "../modules/runs/runs.types.js";

function inst(id: bigint, sectionId: bigint, status = "untested"): TestInstance {
  return {
    id,
    runId: 1n,
    caseId: id,
    status: status as TestInstance["status"],
    assignedTo: null,
    titleSnapshot: `Case ${id}`,
    prioritySnapshot: "medium",
    typeSnapshot: "functional",
    estimateSnapshot: null,
    automationKeySnapshot: null,
    externalIdSnapshot: null,
    sectionId,
    casePriority: "medium",
    caseType: "functional"
  };
}

describe("buildRunInstanceGroups", () => {
  it("groups instances by section in tree order", () => {
    const sections = [
      { id: 2n, name: "B", displayOrder: 0, parentSectionId: null },
      { id: 1n, name: "A", displayOrder: 0, parentSectionId: null }
    ];
    const { groups } = buildRunInstanceGroups([inst(10n, 2n), inst(11n, 1n)], sections, "section_id");
    expect(groups.map((g) => g.groupLabel)).toEqual(["A", "B"]);
    expect(groups[0]!.cases).toHaveLength(1);
  });
});
