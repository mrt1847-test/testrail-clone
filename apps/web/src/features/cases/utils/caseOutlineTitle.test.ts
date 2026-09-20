import { describe, expect, it } from "vitest";

import { normalizeCaseOutlineTitle } from "./caseOutlineTitle";

describe("normalizeCaseOutlineTitle", () => {
  it("trims a title and rejects blanks", () => {
    expect(normalizeCaseOutlineTitle("  Login flow  ")).toBe("Login flow");
    expect(normalizeCaseOutlineTitle("")).toBeNull();
    expect(normalizeCaseOutlineTitle("   ")).toBeNull();
  });
});
