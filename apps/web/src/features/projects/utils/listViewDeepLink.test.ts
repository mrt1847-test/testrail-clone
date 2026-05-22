import { describe, expect, it } from "vitest";

import {
  CASE_REPOSITORY_PARAM_KEYS,
  captureListStateForEntityShare,
  captureListStateFromSearch,
  mergeSearchParams,
  pickSearchParams
} from "./listViewDeepLink";

describe("listViewDeepLink", () => {
  it("picks only known keys for a scope", () => {
    const source = new URLSearchParams(
      "q=login&priority=high&focusCaseId=9&panelCaseId=1&unknown=drop&suiteId=2"
    );
    const picked = pickSearchParams(source, CASE_REPOSITORY_PARAM_KEYS);
    expect(picked.get("q")).toBe("login");
    expect(picked.get("priority")).toBe("high");
    expect(picked.get("focusCaseId")).toBe("9");
    expect(picked.get("suiteId")).toBe("2");
    expect(picked.has("unknown")).toBe(false);
  });

  it("captures case repository state from search", () => {
    const params = captureListStateFromSearch("?groupBy=priority&page=99&sortBy=title", "case-repository");
    expect(params.get("groupBy")).toBe("priority");
    expect(params.has("page")).toBe(false);
  });

  it("merges extra params onto a path", () => {
    expect(mergeSearchParams("/projects/p1/runs/3?status=failed", new URLSearchParams("page=2"))).toBe(
      "/projects/p1/runs/3?status=failed&page=2"
    );
  });

  it("builds case share params from repository pathname", () => {
    const params = captureListStateForEntityShare(
      "case",
      "/projects/p1/cases",
      "?q=auth&sectionId=4&focusCaseId=12"
    );
    expect(params.get("q")).toBe("auth");
    expect(params.get("sectionId")).toBe("4");
    expect(params.get("focusCaseId")).toBe("12");
  });

  it("captures run execution state on run detail pathname", () => {
    const params = captureListStateForEntityShare(
      "run",
      "/projects/p1/runs/r1",
      "?testId=t9&page=3&sortBy=title&sortDir=asc"
    );
    expect(params.get("testId")).toBe("t9");
    expect(params.get("page")).toBe("3");
    expect(params.get("sortBy")).toBe("title");
  });
});
