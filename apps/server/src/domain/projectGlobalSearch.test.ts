import { describe, expect, it } from "vitest";

import { parseGlobalSearchQuery } from "./projectGlobalSearch.js";

describe("parseGlobalSearchQuery", () => {
  it("returns null for empty input", () => {
    expect(parseGlobalSearchQuery("   ")).toBeNull();
  });

  it("parses entity prefix ids", () => {
    expect(parseGlobalSearchQuery("C501")).toMatchObject({
      caseId: 501n,
      text: ""
    });
    expect(parseGlobalSearchQuery("r12")).toMatchObject({
      runId: 12n,
      text: ""
    });
    expect(parseGlobalSearchQuery("M3")).toMatchObject({
      milestoneId: 3n,
      text: ""
    });
    expect(parseGlobalSearchQuery("P9")).toMatchObject({
      planId: 9n,
      text: ""
    });
  });

  it("parses hash and numeric shortcuts", () => {
    expect(parseGlobalSearchQuery("#44")?.caseId).toBe(44n);
    const numeric = parseGlobalSearchQuery("77");
    expect(numeric?.caseId).toBe(77n);
    expect(numeric?.runId).toBe(77n);
  });

  it("keeps free-text queries", () => {
    expect(parseGlobalSearchQuery("login flow")?.text).toBe("login flow");
  });
});
