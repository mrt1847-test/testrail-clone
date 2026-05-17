import { describe, expect, it } from "vitest";

import { hasRangeMultiSelectModifier, resolveRangeMultiSelectClick } from "./rangeMultiSelect";

const ordered = ["a", "b", "c", "d", "e"];

describe("resolveRangeMultiSelectClick", () => {
  it("shift-selects an inclusive range from the anchor", () => {
    const result = resolveRangeMultiSelectClick({
      orderedIds: ordered,
      clickedId: "d",
      selected: new Set(["a"]),
      anchorIndex: 1,
      shiftKey: true,
      ctrlKey: false,
      metaKey: false
    });
    expect(result).toEqual({
      kind: "applied",
      selected: new Set(["a", "b", "c", "d"]),
      anchorIndex: 3
    });
  });

  it("ctrl-toggles a single row", () => {
    const result = resolveRangeMultiSelectClick({
      orderedIds: ordered,
      clickedId: "c",
      selected: new Set(["a", "b"]),
      anchorIndex: 0,
      shiftKey: false,
      ctrlKey: true,
      metaKey: false
    });
    expect(result).toEqual({
      kind: "applied",
      selected: new Set(["a", "b", "c"]),
      anchorIndex: 2
    });
  });

  it("ctrl-toggles off when already selected", () => {
    const result = resolveRangeMultiSelectClick({
      orderedIds: ordered,
      clickedId: "b",
      selected: new Set(["a", "b"]),
      anchorIndex: 0,
      shiftKey: false,
      ctrlKey: false,
      metaKey: true
    });
    expect(result).toEqual({
      kind: "applied",
      selected: new Set(["a"]),
      anchorIndex: 1
    });
  });

  it("defers to default checkbox handling without modifiers", () => {
    expect(
      resolveRangeMultiSelectClick({
        orderedIds: ordered,
        clickedId: "c",
        selected: new Set(),
        anchorIndex: 1,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false
      }).kind
    ).toBe("default");
  });

  it("defers shift-click when there is no anchor yet", () => {
    expect(
      resolveRangeMultiSelectClick({
        orderedIds: ordered,
        clickedId: "c",
        selected: new Set(["a"]),
        anchorIndex: null,
        shiftKey: true,
        ctrlKey: false,
        metaKey: false
      }).kind
    ).toBe("default");
  });
});

describe("hasRangeMultiSelectModifier", () => {
  it("detects shift, ctrl, and meta", () => {
    expect(hasRangeMultiSelectModifier({ shiftKey: true, ctrlKey: false, metaKey: false })).toBe(true);
    expect(hasRangeMultiSelectModifier({ shiftKey: false, ctrlKey: true, metaKey: false })).toBe(true);
    expect(hasRangeMultiSelectModifier({ shiftKey: false, ctrlKey: false, metaKey: true })).toBe(true);
    expect(hasRangeMultiSelectModifier({ shiftKey: false, ctrlKey: false, metaKey: false })).toBe(false);
  });
});
