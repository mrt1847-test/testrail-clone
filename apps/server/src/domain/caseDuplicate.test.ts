import { describe, expect, it } from "vitest";

import { buildDuplicateCaseTitle } from "./caseDuplicate.js";

describe("buildDuplicateCaseTitle", () => {
  it("appends (copy) once", () => {
    expect(buildDuplicateCaseTitle("Login")).toBe("Login (copy)");
    expect(buildDuplicateCaseTitle("Login (copy)")).toBe("Login (copy)");
    expect(buildDuplicateCaseTitle("  ")).toBe("Untitled (copy)");
  });
});
