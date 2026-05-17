import { describe, expect, it } from "vitest";

import { buildUserWorkloadSummary } from "./userWorkloadSummary.js";

describe("buildUserWorkloadSummary", () => {
  it("aggregates assignment workload per user", () => {
    const report = buildUserWorkloadSummary(
      [
        {
          userId: "10",
          name: "Alex",
          email: "alex@example.com",
          status: "untested",
          agingLevel: "overdue"
        },
        {
          userId: "10",
          name: "Alex",
          email: "alex@example.com",
          status: "failed",
          agingLevel: "stale"
        },
        {
          userId: "20",
          name: "Blair",
          email: "blair@example.com",
          status: "passed",
          agingLevel: "none"
        }
      ],
      3
    );

    expect(report.totalAssignees).toBe(2);
    expect(report.totalAssignedTests).toBe(3);
    expect(report.totalActiveTests).toBe(2);
    expect(report.unassignedActiveCount).toBe(3);
    expect(report.items[0]).toMatchObject({
      userId: "10",
      assignedCount: 2,
      activeCount: 2,
      overdueCount: 1,
      staleCount: 1
    });
    expect(report.items.find((row) => row.userId === "20")).toMatchObject({
      activeCount: 0,
      passedCount: 1
    });
  });
});
