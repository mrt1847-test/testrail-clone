import { describe, expect, it } from "vitest";

import { mergeDefectKeys, splitDefectKeys } from "./resultEntryUtils";

describe("defect key helpers", () => {
  it("splits and uppercases comma/whitespace separated keys", () => {
    expect(splitDefectKeys("cart-21, bug-9")).toEqual(["CART-21", "BUG-9"]);
    expect(splitDefectKeys("  ")).toEqual([]);
  });

  it("merges a still-typed draft so Save without Enter keeps the visible key", () => {
    expect(mergeDefectKeys([], "CART-21")).toEqual(["CART-21"]);
    expect(mergeDefectKeys(["BUG-1"], "cart-21")).toEqual(["BUG-1", "CART-21"]);
    expect(mergeDefectKeys(["CART-21"], "CART-21")).toEqual(["CART-21"]);
    expect(mergeDefectKeys(["BUG-1"], "  ")).toEqual(["BUG-1"]);
  });
});
