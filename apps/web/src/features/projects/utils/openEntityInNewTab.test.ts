import { describe, expect, it } from "vitest";

import { getEntityShareUrl } from "./openEntityInNewTab";

describe("getEntityShareUrl", () => {
  it("builds absolute case detail urls", () => {
    const url = getEntityShareUrl({
      projectId: "p1",
      kind: "case",
      entityId: 12,
      sectionId: 3
    });
    expect(url).toContain("/projects/p1/cases/12");
    expect(url).toContain("sectionId=3");
  });

  it("builds run and milestone paths", () => {
    expect(getEntityShareUrl({ projectId: "p1", kind: "run", entityId: "5" })).toMatch(/\/runs\/5$/);
    expect(getEntityShareUrl({ projectId: "p1", kind: "milestone", entityId: "2" })).toMatch(/\/milestones\/2$/);
  });
});
