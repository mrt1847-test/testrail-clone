import { describe, expect, it } from "vitest";

import { myTestsHeaderMenuGroups } from "./myTestsHeaderMenu";

describe("myTestsHeaderMenuGroups", () => {
  it("keeps reporting and team views out of the primary queue path", () => {
    const groups = myTestsHeaderMenuGroups("project-1");
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));

    expect(groups.map((group) => group.label)).toEqual(["Workflow", "Reports"]);
    expect(labels).toEqual(["Team to-do", "Users workload", "All reports"]);
    expect(labels).not.toContain("Add result");
  });
});
