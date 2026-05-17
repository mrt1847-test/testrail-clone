import { describe, expect, it, beforeEach } from "vitest";

import {
  readCollapsedSectionIds,
  sectionTreeCollapseStorageKey,
  writeCollapsedSectionIds
} from "./sectionTreeCollapse";

describe("sectionTreeCollapse", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists collapsed section ids per project and suite", () => {
    const key = sectionTreeCollapseStorageKey("p1", "s2");
    expect(key).toBe("cases:section-tree-collapsed:p1:s2");

    writeCollapsedSectionIds("p1", "s2", new Set([10, 20]));
    expect(readCollapsedSectionIds("p1", "s2")).toEqual(new Set([10, 20]));
    expect(readCollapsedSectionIds("p1", "s9")).toEqual(new Set());
  });
});
