import { describe, expect, it } from "vitest";

import { buildActivityDrilldownHref } from "./projectActivityDrilldown";

describe("buildActivityDrilldownHref", () => {
  it("links status-only drilldown to runs list", () => {
    expect(buildActivityDrilldownHref("1", { status: "passed" })).toBe("/projects/1/runs?resultStatus=passed");
  });

  it("links date drilldown to result explorer with day bounds", () => {
    const href = buildActivityDrilldownHref("2", { date: "2026-05-17", status: "failed" });
    expect(href).toContain("/projects/2/results?");
    expect(href).toContain("status=failed");
    expect(href).toContain("createdFrom=2026-05-17T00%3A00%3A00.000Z");
    expect(href).toContain("createdTo=2026-05-17T23%3A59%3A59.999Z");
  });
});
