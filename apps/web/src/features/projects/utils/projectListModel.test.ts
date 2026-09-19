import { describe, expect, it } from "vitest";

import { formatProjectListProgress, projectListCreatePlacement, projectListNavLinks } from "./projectListModel";

describe("project list model", () => {
  it("puts the only create action in empty state, then the header", () => {
    expect(projectListCreatePlacement({ canCreate: true, projectCount: 0 })).toBe("empty");
    expect(projectListCreatePlacement({ canCreate: true, projectCount: 2 })).toBe("header");
    expect(projectListCreatePlacement({ canCreate: false, projectCount: 0 })).toBe("none");
    expect(projectListCreatePlacement({ canCreate: false, projectCount: 2 })).toBe("none");
  });

  it("summarizes cases and active runs without inventing extra KPIs", () => {
    expect(formatProjectListProgress({ totalCases: 2, activeRuns: 1 })).toBe("2 cases · 1 active run");
    expect(formatProjectListProgress({ loading: true })).toBe("Loading progress…");
    expect(projectListNavLinks("9").map((link) => link.label)).toEqual(["Cases", "Runs", "Assigned"]);
  });
});
