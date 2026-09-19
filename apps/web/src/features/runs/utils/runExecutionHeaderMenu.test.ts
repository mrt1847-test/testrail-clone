import { describe, expect, it } from "vitest";

import { runExecutionHeaderMenuGroups } from "./runExecutionHeaderMenu";

describe("runExecutionHeaderMenuGroups", () => {
  it("keeps run utilities grouped away from result recording", () => {
    const groups = runExecutionHeaderMenuGroups("project-1", "run-9", "suite-2");
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));

    expect(groups.map((group) => group.label)).toEqual(["Run management", "Reports", "Output"]);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Activity",
        "Duplicate run",
        "Compare runs",
        "Create rerun",
        "Run summary",
        "Traceability",
        "Print view",
        "Export tests (CSV)",
        "Export results (CSV)"
      ])
    );
    expect(labels).not.toContain("Pass & Next");
    expect(labels).not.toContain("Record result");
  });
});
