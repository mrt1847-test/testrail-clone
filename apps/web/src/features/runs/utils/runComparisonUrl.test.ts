import { describe, expect, it } from "vitest";

import { buildRunComparisonPath } from "./runComparisonUrl";

describe("buildRunComparisonPath", () => {
  it("builds compare path with run query params", () => {
    expect(buildRunComparisonPath("9", { runIdA: "1", runIdB: "2", change: "changed" })).toBe(
      "/projects/9/runs/compare?runA=1&runB=2&change=changed"
    );
  });

  it("omits empty query", () => {
    expect(buildRunComparisonPath("9")).toBe("/projects/9/runs/compare");
  });
});
