import { describe, expect, it } from "vitest";

import { resolveStatusFlags } from "../domain/customStatusPolicy.js";

describe("custom status policy", () => {
  it("derives defaults from canonical status", () => {
    expect(resolveStatusFlags("untested")).toEqual({ isUntested: true, isFinal: false });
    expect(resolveStatusFlags("passed")).toEqual({ isUntested: false, isFinal: true });
    expect(resolveStatusFlags("retest")).toEqual({ isUntested: false, isFinal: false });
  });

  it("honors explicit overrides", () => {
    expect(resolveStatusFlags("passed", { isFinal: false, isUntested: false })).toEqual({
      isUntested: false,
      isFinal: false
    });
  });
});
