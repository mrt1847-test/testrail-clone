import { describe, expect, it } from "vitest";

import { buildOverviewWorkRows, formatOverviewExecution, formatOverviewRunSummary } from "./projectOverviewModel";

describe("project overview model", () => {
  it("keeps execution remaining and names open runs before plans", () => {
    expect(formatOverviewExecution({ total: 4, passed: 1, failed: 0, remaining: 3 })).toBe(
      "1 passed · 0 failed · 3 remaining"
    );
    expect(
      formatOverviewRunSummary(
        { id: "1", name: "Alpha", status: "open", progress: 50, total: 2, passed: 1, failed: 0, createdAt: "-" },
        {
          id: "1",
          type: "run",
          name: "Alpha",
          createdAt: "-",
          createdBy: null,
          statusCounts: { untested: 1, blocked: 1 },
          percentPassed: 50,
          percentComplete: 50,
          totalTests: 2,
          editPath: "",
          viewPath: ""
        }
      )
    ).toBe("2 tests · 1 untested · 1 blocked · 50% passed");

    const rows = buildOverviewWorkRows({
      projectId: "1",
      recentRuns: [
        { id: "1", name: "Alpha", status: "open", progress: 50, total: 2, passed: 1, failed: 0, createdAt: "-" },
        { id: "9", name: "Nightly", status: "closed", progress: 100, total: 2, passed: 2, failed: 0, createdAt: "-" }
      ],
      plans: [{ id: "p1", name: "Release week" } as never],
      overviewItems: []
    });
    expect(rows.map((row) => row.name)).toEqual(["Alpha", "Release week"]);
    expect(rows[0]?.href).toBe("/projects/1/runs/1");
  });
});
