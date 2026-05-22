import { beforeEach, describe, expect, it } from "vitest";

import { suiteStorageKey } from "../workspacePreferences";
import {
  getPinnedDefaultSuiteId,
  isProjectPinned,
  partitionPinnedProjects,
  setPinnedDefaultSuite,
  togglePinnedProject,
  userPinsStorageKey
} from "./pinnedProjects";

describe("pinnedProjects", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggles project pins per user", () => {
    togglePinnedProject("u1", "p1");
    expect(isProjectPinned("u1", "p1")).toBe(true);
    togglePinnedProject("u1", "p1");
    expect(isProjectPinned("u1", "p1")).toBe(false);
    expect(isProjectPinned("u2", "p1")).toBe(false);
  });

  it("stores pinned default suite and syncs suite storage key", () => {
    setPinnedDefaultSuite("u1", "p1", "suite-9");
    expect(getPinnedDefaultSuiteId("u1", "p1")).toBe("suite-9");
    expect(localStorage.getItem(suiteStorageKey("p1", "u1"))).toBe("suite-9");
  });

  it("partitions pinned projects first", () => {
    const projects = [
      { id: "b", name: "B" },
      { id: "a", name: "A" },
      { id: "c", name: "C" }
    ];
    const { pinned, others } = partitionPinnedProjects(projects, ["c", "a"]);
    expect(pinned.map((p) => p.id)).toEqual(["c", "a"]);
    expect(others.map((p) => p.id)).toEqual(["b"]);
  });

  it("uses distinct storage keys per user", () => {
    expect(userPinsStorageKey("u1")).toContain("u1");
  });
});
