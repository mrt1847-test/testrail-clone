import { describe, expect, it } from "vitest";

import { applyExcludedSelectionMode, applyIdSelectionMode } from "../modules/runs/runFilterSelection.js";

describe("run filter selection modes", () => {
  it("applies set/add/remove on explicit id lists", () => {
    expect(applyIdSelectionMode("set", ["1", "2"], ["2", "3"])).toEqual(["2", "3"]);
    expect(applyIdSelectionMode("add", ["1"], ["2", "3"])).toEqual(["1", "2", "3"]);
    expect(applyIdSelectionMode("remove", ["1", "2", "3"], ["2"])).toEqual(["1", "3"]);
  });

  it("applies set/add/remove via excluded ids for include-all style runs", () => {
    const all = ["1", "2", "3", "4"];
    expect(applyExcludedSelectionMode("set", all, [], ["2", "3"])).toEqual(["1", "4"]);
    expect(applyExcludedSelectionMode("add", all, ["1"], ["2"])).toEqual(["1"]);
    expect(applyExcludedSelectionMode("remove", all, [], ["2", "3"])).toEqual(["2", "3"]);
  });
});
