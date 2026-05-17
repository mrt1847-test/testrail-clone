import { describe, expect, it } from "vitest";

import {
  assertMilestoneParentLink,
  orderMilestonesForHierarchy,
  resolveMilestoneLifecycleStatus
} from "./milestoneLifecycle.js";

describe("milestoneLifecycle", () => {
  it("resolves upcoming, open, and completed states", () => {
    const now = new Date("2026-05-17T12:00:00.000Z");
    expect(
      resolveMilestoneLifecycleStatus({
        isCompleted: false,
        startDate: "2026-06-01T00:00:00.000Z",
        now
      })
    ).toBe("upcoming");
    expect(
      resolveMilestoneLifecycleStatus({
        isCompleted: false,
        startDate: "2026-05-01T00:00:00.000Z",
        now
      })
    ).toBe("open");
    expect(resolveMilestoneLifecycleStatus({ isCompleted: true, now })).toBe("completed");
  });

  it("rejects parent cycles", () => {
    const rows = [
      { id: 1n, parentMilestoneId: 2n },
      { id: 2n, parentMilestoneId: 1n }
    ];
    expect(() =>
      assertMilestoneParentLink({ milestoneId: 1n, parentMilestoneId: 2n, rows })
    ).toThrow("MILESTONE_PARENT_CYCLE");
  });

  it("orders milestones depth-first by parent", () => {
    const ordered = orderMilestonesForHierarchy([
      { id: "2", parentMilestoneId: "1", name: "Child" },
      { id: "1", parentMilestoneId: null, name: "Root" }
    ]);
    expect(ordered.map((row) => row.id)).toEqual(["1", "2"]);
    expect(ordered[1]?.depth).toBe(1);
  });
});
