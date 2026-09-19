import { describe, expect, it } from "vitest";

import {
  appendAssignmentListQueryParams,
  assignmentFiltersAreDefault,
  countActiveAssignmentFilters,
  defaultAssignmentListFilters,
  describeActiveAssignmentFilters,
  parseAssignmentListFilters
} from "./assignmentListFilters";

describe("assignment list filters", () => {
  it("treats the current assignment defaults as unfiltered", () => {
    expect(assignmentFiltersAreDefault(defaultAssignmentListFilters)).toBe(true);
    expect(countActiveAssignmentFilters(defaultAssignmentListFilters)).toBe(0);
    expect(describeActiveAssignmentFilters(defaultAssignmentListFilters)).toEqual([]);
  });

  it("round-trips applied filters so completed or blocked work is not silently hidden", () => {
    const params = new URLSearchParams();
    appendAssignmentListQueryParams(params, {
      status: "failed",
      runId: "2",
      search: "login",
      milestoneId: "all",
      dueFilter: "overdue",
      dueBy: ""
    });
    expect(params.get("status")).toBe("failed");
    expect(params.get("runId")).toBe("2");
    expect(params.get("q")).toBe("login");
    expect(params.get("overdue")).toBe("true");
    expect(parseAssignmentListFilters(params)).toEqual({
      status: "failed",
      runId: "2",
      search: "login",
      milestoneId: "all",
      dueFilter: "overdue",
      dueBy: ""
    });
  });

  it("names the active filters a tester applied", () => {
    expect(
      describeActiveAssignmentFilters(
        {
          status: "blocked",
          runId: "1",
          search: "",
          milestoneId: "all",
          dueFilter: "all",
          dueBy: ""
        },
        { runName: "Alpha regression" }
      )
    ).toEqual(["Status: blocked", "Run: Alpha regression"]);
    expect(countActiveAssignmentFilters({ ...defaultAssignmentListFilters, status: "blocked", runId: "1" })).toBe(2);
  });
});
