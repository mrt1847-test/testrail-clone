import { describe, expect, it } from "vitest";

import { defaultCompositionMetadata } from "./runComposition.js";
import { buildDuplicateRunCreateInput } from "./runDuplicate.js";
import type { TestRun } from "./runs.types.js";

const baseRun: TestRun = {
  id: 1n,
  projectId: 10n,
  suiteId: 20n,
  milestoneId: 30n,
  name: "Sprint 4 regression",
  includeAll: false,
  status: "open",
  assignedTo: 99n,
  environment: "staging",
  startedAt: new Date("2026-05-01"),
  dueOn: new Date("2026-05-15"),
  composition: {
    compositionMode: "static",
    excludedCaseIds: ["101"]
  }
};

describe("buildDuplicateRunCreateInput", () => {
  it("copies static composition and explicit case ids from instances", () => {
    const input = buildDuplicateRunCreateInput(baseRun, [201n, 202n], {
      copyAssignee: true,
      copySchedule: false,
      copyEnvironment: true
    });
    expect(input).toMatchObject({
      projectId: 10n,
      suiteId: 20n,
      milestoneId: 30n,
      name: "Sprint 4 regression (copy)",
      includeAll: false,
      compositionMode: "static",
      caseIds: [201n, 202n],
      excludedCaseIds: [101n],
      assignedTo: 99n,
      environment: "staging",
      startedAt: null,
      dueOn: null
    });
  });

  it("honors overrides for name, milestone, and copy flags", () => {
    const input = buildDuplicateRunCreateInput(baseRun, [201n], {
      name: "Sprint 5 regression",
      milestoneId: null,
      copyAssignee: false,
      copySchedule: true,
      copyEnvironment: false
    });
    expect(input.name).toBe("Sprint 5 regression");
    expect(input.milestoneId).toBeNull();
    expect(input.assignedTo).toBeNull();
    expect(input.environment).toBeNull();
    expect(input.startedAt).toEqual(baseRun.startedAt);
    expect(input.dueOn).toEqual(baseRun.dueOn);
  });

  it("preserves live composition metadata without case ids", () => {
    const liveRun: TestRun = {
      ...baseRun,
      includeAll: true,
      composition: defaultCompositionMetadata(true, "include_all_live")
    };
    const input = buildDuplicateRunCreateInput(liveRun, [], { copyAssignee: false });
    expect(input.includeAll).toBe(true);
    expect(input.compositionMode).toBe("include_all_live");
    expect(input.caseIds).toBeUndefined();
  });
});
