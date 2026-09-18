import { describe, expect, it } from "vitest";

import { planDetailHeaderMenuGroups, planListHeaderMenuGroups } from "./planHeaderMenu";

describe("planHeaderMenuGroups", () => {
  it("keeps reports out of the primary Add Plan path", () => {
    const labels = planListHeaderMenuGroups("p1").flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual(["Plan summary", "All reports"]);
    expect(labels).not.toContain("Add Plan");
  });

  it("keeps defaults, reports, and print out of the Add entry slot", () => {
    const groups = planDetailHeaderMenuGroups("p1", "9", { onPlanDefaults: () => undefined });
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));
    expect(groups.map((group) => group.label)).toEqual(["Plan settings", "Reports", "Output"]);
    expect(labels).toEqual(["Plan defaults", "Plan summary", "All reports", "Print view"]);
    expect(labels).not.toContain("Add entry");
    expect(labels).not.toContain("Generate next run");
  });
});
