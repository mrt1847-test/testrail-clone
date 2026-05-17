import { describe, expect, it } from "vitest";

import { mapConfigForV2, mapMilestone, testRailEpochToDate } from "./testrail.mappers.js";

describe("testRail planning mappers", () => {
  it("converts TestRail epoch seconds to dates", () => {
    const date = testRailEpochToDate(1_700_000_000);
    expect(date).toEqual(new Date(1_700_000_000_000));
    expect(testRailEpochToDate(null)).toBeNull();
    expect(testRailEpochToDate(undefined)).toBeUndefined();
  });

  it("maps milestone schedule fields for v2 clients", () => {
    const mapped = mapMilestone({
      id: 12n,
      projectId: 3n,
      parentMilestoneId: null,
      name: "Release 1",
      description: "Scope",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      dueDate: new Date("2026-02-01T00:00:00.000Z"),
      isCompleted: false
    });
    expect(mapped).toMatchObject({
      id: 12,
      project_id: 3,
      name: "Release 1",
      description: "Scope",
      is_completed: false
    });
    expect(mapped.start_on).toBe(Math.floor(new Date("2026-01-01T00:00:00.000Z").getTime() / 1000));
  });

  it("maps configuration rows", () => {
    expect(mapConfigForV2({ id: 9n, groupId: 2n, name: "Chrome" })).toEqual({
      id: 9,
      group_id: 2,
      name: "Chrome"
    });
  });
});
