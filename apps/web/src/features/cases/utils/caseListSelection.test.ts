import { describe, expect, it } from "vitest";

import { buildSectionOnlyFilters, hasActiveCaseListFilters, mergeNumericIds } from "./caseListSelection";
import type { CaseListFilters } from "../types";

const baseFilters: CaseListFilters = {
  q: "",
  priority: "",
  caseType: "",
  automation: "",
  refs: "",
  labels: "",
  estimate: "",
  state: "active"
};

describe("caseListSelection", () => {
  it("detects active list filters", () => {
    expect(hasActiveCaseListFilters(baseFilters)).toBe(false);
    expect(hasActiveCaseListFilters({ ...baseFilters, q: "login" })).toBe(true);
    expect(hasActiveCaseListFilters({ ...baseFilters, priority: "high" })).toBe(true);
    expect(hasActiveCaseListFilters({ ...baseFilters, state: "archived" })).toBe(true);
  });

  it("builds section-only filters from the current archive state", () => {
    expect(buildSectionOnlyFilters({ ...baseFilters, q: "x", priority: "low", state: "archived" })).toEqual({
      ...baseFilters,
      state: "archived"
    });
  });

  it("merges ids into a selection set", () => {
    expect(mergeNumericIds(new Set([1]), [2, 3])).toEqual(new Set([1, 2, 3]));
  });
});
