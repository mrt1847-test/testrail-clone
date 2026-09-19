import { describe, expect, it } from "vitest";

import { runListHeaderMenuGroups } from "./runListHeaderMenu";

describe("runListHeaderMenuGroups", () => {
  it("keeps Add Run out of utilities and groups plan, compare, and reports", () => {
    const groups = runListHeaderMenuGroups("project-1");
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));

    expect(groups.map((group) => group.label)).toEqual(["Workflow", "Reports"]);
    expect(labels).toEqual(
      expect.arrayContaining(["Compare runs", "Manage plans", "Runs summary", "All reports"])
    );
    expect(labels).not.toContain("Add test plan");
    expect(labels).not.toContain("Add Run");
    expect(labels).not.toContain("Add Test Run");
    expect(labels).not.toContain("New run");
  });
});
