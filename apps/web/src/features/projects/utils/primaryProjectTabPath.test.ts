import { describe, expect, it } from "vitest";

import { isPrimaryProjectTabPath } from "./primaryProjectTabPath";

describe("isPrimaryProjectTabPath", () => {
  it("hides the breadcrumb on overview and primary tabs", () => {
    expect(isPrimaryProjectTabPath("/projects/1")).toBe(true);
    expect(isPrimaryProjectTabPath("/projects/1/cases")).toBe(true);
    expect(isPrimaryProjectTabPath("/projects/1/settings")).toBe(true);
  });

  it("keeps the breadcrumb on nested project routes", () => {
    expect(isPrimaryProjectTabPath("/projects/1/runs/9")).toBe(false);
    expect(isPrimaryProjectTabPath("/projects/1/cases/print")).toBe(false);
    expect(isPrimaryProjectTabPath("/projects/1/settings/tokens")).toBe(false);
  });
});
