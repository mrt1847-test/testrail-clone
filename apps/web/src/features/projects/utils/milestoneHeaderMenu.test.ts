import { describe, expect, it } from "vitest";

import { milestoneHeaderMenuGroups } from "./milestoneHeaderMenu";

describe("milestoneHeaderMenuGroups", () => {
  it("keeps reports out of the primary Add Milestone path", () => {
    const groups = milestoneHeaderMenuGroups("project-1");
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));

    expect(groups.map((group) => group.label)).toEqual(["Reports"]);
    expect(labels).toContain("Milestone summary");
    expect(labels).toContain("All reports");
    expect(labels).not.toContain("Add Milestone");
    expect(labels).not.toContain("Add milestone");
  });
});
