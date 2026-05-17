import { describe, expect, it } from "vitest";

import {
  buildMilestoneDashboard,
  buildMilestoneSummaryPayload,
  enrichMilestoneSummaries
} from "./milestoneRollup.js";

describe("milestoneRollup", () => {
  it("rolls child run metrics into parent milestone summary", () => {
    const milestones = [
      { milestoneId: "1", name: "Release", parentMilestoneId: null, isCompleted: false },
      { milestoneId: "2", name: "Sprint A", parentMilestoneId: "1", isCompleted: false }
    ];
    const directById = new Map([
      ["1", { statuses: ["passed", "failed"], runCount: 1, openRunCount: 1 }],
      ["2", { statuses: ["passed", "passed", "untested"], runCount: 2, openRunCount: 0 }]
    ]);

    const items = enrichMilestoneSummaries(milestones, directById);
    const parent = items.find((row) => row.milestoneId === "1");
    const child = items.find((row) => row.milestoneId === "2");

    expect(parent).toMatchObject({
      childCount: 1,
      runCount: 3,
      openRunCount: 1,
      total: 5,
      passed: 3,
      failed: 1,
      progress: 60,
      directRunCount: 1,
      directTotal: 2,
      includesSubMilestones: true
    });
    expect(child).toMatchObject({
      childCount: 0,
      runCount: 2,
      total: 3,
      includesSubMilestones: false
    });
  });

  it("builds dashboard from root rollups without double-counting children", () => {
    const { items, dashboard } = buildMilestoneSummaryPayload(
      [
        { milestoneId: "1", name: "Root", parentMilestoneId: null, isCompleted: false },
        { milestoneId: "2", name: "Child", parentMilestoneId: "1", isCompleted: false }
      ],
      new Map([
        ["1", { statuses: [], runCount: 0, openRunCount: 0 }],
        ["2", { statuses: ["passed"], runCount: 1, openRunCount: 0 }]
      ])
    );

    expect(items).toHaveLength(2);
    expect(dashboard.rootCount).toBe(1);
    expect(dashboard.linkedRunCount).toBe(1);
    expect(dashboard.totalTests).toBe(1);
    expect(dashboard.topMilestones[0]?.milestoneId).toBe("1");
    expect(dashboard.topMilestones[0]?.progress).toBe(100);
  });

  it("counts lifecycle buckets on dashboard", () => {
    const items = enrichMilestoneSummaries(
      [
        {
          milestoneId: "1",
          name: "Upcoming",
          parentMilestoneId: null,
          isCompleted: false,
          startDate: "2035-01-01T00:00:00.000Z"
        },
        { milestoneId: "2", name: "Open", parentMilestoneId: null, isCompleted: false },
        { milestoneId: "3", name: "Done", parentMilestoneId: null, isCompleted: true }
      ],
      new Map()
    );
    const dashboard = buildMilestoneDashboard(items);
    expect(dashboard.upcomingCount).toBe(1);
    expect(dashboard.openCount).toBe(1);
    expect(dashboard.completedCount).toBe(1);
  });
});
