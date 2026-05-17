import { describe, expect, it } from "vitest";

import { computeAssignmentAging } from "@testrail-clone/shared";

describe("computeAssignmentAging", () => {
  const now = new Date("2026-05-17T12:00:00.000Z");

  it("returns none for completed statuses", () => {
    expect(
      computeAssignmentAging({
        status: "passed",
        runDueOn: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
        now
      })
    ).toBe("none");
  });

  it("flags overdue run due dates for active tests", () => {
    expect(
      computeAssignmentAging({
        status: "untested",
        runDueOn: "2026-05-10T00:00:00.000Z",
        updatedAt: now.toISOString(),
        now
      })
    ).toBe("overdue");
  });

  it("flags due soon within three days", () => {
    expect(
      computeAssignmentAging({
        status: "failed",
        runDueOn: "2026-05-19T00:00:00.000Z",
        updatedAt: now.toISOString(),
        now
      })
    ).toBe("due_soon");
  });

  it("flags stale active assignments without pressing due dates", () => {
    expect(
      computeAssignmentAging({
        status: "blocked",
        runDueOn: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        now
      })
    ).toBe("stale");
  });

  it("prefers overdue over stale", () => {
    expect(
      computeAssignmentAging({
        status: "retest",
        runDueOn: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        now
      })
    ).toBe("overdue");
  });
});
