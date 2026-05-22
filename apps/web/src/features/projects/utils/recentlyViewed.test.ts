import { describe, expect, it, beforeEach } from "vitest";

import {
  filterRecentlyViewed,
  getRecentlyViewed,
  recordRecentlyViewed,
  recentlyViewedStorageKey
} from "./recentlyViewed";

describe("recentlyViewed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("dedupes and orders newest first", () => {
    recordRecentlyViewed("p1", "u1", { kind: "case", id: "1", title: "First" });
    recordRecentlyViewed("p1", "u1", { kind: "run", id: "2", title: "Run A" });
    recordRecentlyViewed("p1", "u1", { kind: "case", id: "1", title: "First updated" });

    const rows = getRecentlyViewed("p1", "u1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "case", id: "1", title: "First updated" });
    expect(rows[1]).toMatchObject({ kind: "run", id: "2" });
  });

  it("scopes storage per project and user", () => {
    recordRecentlyViewed("p1", "u1", { kind: "milestone", id: "3", title: "M3" });
    expect(getRecentlyViewed("p2", "u1")).toHaveLength(0);
    expect(getRecentlyViewed("p1", "u2")).toHaveLength(0);
    expect(recentlyViewedStorageKey("p1", "u1")).toContain("u1");
  });

  it("filters by title and id token", () => {
    const entries = [
      { kind: "case" as const, id: "12", title: "Login flow", viewedAt: 1 },
      { kind: "run" as const, id: "5", title: "Smoke", viewedAt: 2 }
    ];
    expect(filterRecentlyViewed(entries, "login")).toHaveLength(1);
    expect(filterRecentlyViewed(entries, "r5")).toHaveLength(1);
  });
});
