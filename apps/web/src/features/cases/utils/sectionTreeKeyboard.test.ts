import { describe, expect, it } from "vitest";

import { resolveSectionTreeKey, sectionCreateFieldId, visibleSectionIds } from "./sectionTreeKeyboard";

const sections = [
  { id: 1, parentSectionId: null, displayOrder: 0 },
  { id: 2, parentSectionId: 1, displayOrder: 0 },
  { id: 3, parentSectionId: 2, displayOrder: 0 },
  { id: 4, parentSectionId: null, displayOrder: 1 }
];

describe("sectionCreateFieldId", () => {
  it("uses the shared root field id so the S shortcut and label stay associated", () => {
    expect(sectionCreateFieldId(null)).toBe("case-repository-new-section");
    expect(sectionCreateFieldId(12)).toBe("new-section-12");
  });
});

describe("visibleSectionIds", () => {
  it("hides descendants of collapsed parents", () => {
    expect(visibleSectionIds(sections, [])).toEqual([1, 2, 3, 4]);
    expect(visibleSectionIds(sections, [1])).toEqual([1, 4]);
    expect(visibleSectionIds(sections, [2])).toEqual([1, 2, 4]);
  });
});

describe("resolveSectionTreeKey", () => {
  it("moves selection with arrows without expanding or collapsing", () => {
    expect(
      resolveSectionTreeKey({
        key: "ArrowDown",
        currentId: 1,
        sections,
        collapsedIds: []
      })
    ).toEqual({ type: "select", sectionId: 2 });
    expect(
      resolveSectionTreeKey({
        key: "ArrowUp",
        currentId: 3,
        sections,
        collapsedIds: []
      })
    ).toEqual({ type: "select", sectionId: 2 });
  });

  it("keeps expand/collapse distinct from selection", () => {
    expect(
      resolveSectionTreeKey({
        key: "ArrowRight",
        currentId: 1,
        sections,
        collapsedIds: [1]
      })
    ).toEqual({ type: "expand", sectionId: 1 });
    expect(
      resolveSectionTreeKey({
        key: "ArrowRight",
        currentId: 1,
        sections,
        collapsedIds: []
      })
    ).toEqual({ type: "select", sectionId: 2 });
    expect(
      resolveSectionTreeKey({
        key: "ArrowLeft",
        currentId: 1,
        sections,
        collapsedIds: []
      })
    ).toEqual({ type: "collapse", sectionId: 1 });
    expect(
      resolveSectionTreeKey({
        key: "ArrowLeft",
        currentId: 3,
        sections,
        collapsedIds: []
      })
    ).toEqual({ type: "select", sectionId: 2 });
  });

  it("opens the row actions from the treeitem keyboard", () => {
    expect(
      resolveSectionTreeKey({
        key: "F10",
        shiftKey: true,
        currentId: 2,
        sections,
        collapsedIds: []
      })
    ).toEqual({ type: "openActions" });
  });
});
