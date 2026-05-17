import { describe, expect, it } from "vitest";

import { matchesAssignmentListFiltersInMemory } from "./assignmentListFilters.js";

describe("assignmentListFilters", () => {
  const run = {
    milestoneId: 5n,
    dueOn: new Date("2026-06-01T00:00:00Z")
  };

  it("filters by milestone none", () => {
    expect(matchesAssignmentListFiltersInMemory(run, { milestoneId: "none" })).toBe(false);
    expect(matchesAssignmentListFiltersInMemory({ milestoneId: null, dueOn: null }, { milestoneId: "none" })).toBe(
      true
    );
  });

  it("filters by milestone id", () => {
    expect(matchesAssignmentListFiltersInMemory(run, { milestoneId: 5n })).toBe(true);
    expect(matchesAssignmentListFiltersInMemory(run, { milestoneId: 9n })).toBe(false);
  });

  it("filters overdue runs", () => {
    const past = { milestoneId: null, dueOn: new Date("2020-01-01T00:00:00Z") };
    expect(matchesAssignmentListFiltersInMemory(past, { overdue: true })).toBe(true);
    expect(matchesAssignmentListFiltersInMemory(run, { overdue: true })).toBe(false);
  });

  it("filters unset due dates", () => {
    expect(matchesAssignmentListFiltersInMemory({ milestoneId: null, dueOn: null }, { dueUnset: true })).toBe(true);
    expect(matchesAssignmentListFiltersInMemory(run, { dueUnset: true })).toBe(false);
  });
});
