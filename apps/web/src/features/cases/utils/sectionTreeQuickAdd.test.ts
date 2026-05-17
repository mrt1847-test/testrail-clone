import { describe, expect, it } from "vitest";

import { normalizeQuickAddCaseTitle } from "./sectionTreeQuickAdd";

describe("sectionTreeQuickAdd", () => {
  it("trims and rejects empty titles", () => {
    expect(normalizeQuickAddCaseTitle("  Login flow  ")).toBe("Login flow");
    expect(normalizeQuickAddCaseTitle("")).toBeNull();
    expect(normalizeQuickAddCaseTitle("   ")).toBeNull();
  });
});
