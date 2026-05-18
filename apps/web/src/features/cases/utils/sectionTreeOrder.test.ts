import { describe, expect, it } from "vitest";

import { sortSectionIdsDepthFirst } from "./sectionTreeOrder";

describe("sortSectionIdsDepthFirst", () => {
  it("orders children immediately after parents", () => {
    const ids = sortSectionIdsDepthFirst([
      { id: 2, parentSectionId: 1, displayOrder: 0 },
      { id: 1, parentSectionId: null, displayOrder: 0 },
      { id: 3, parentSectionId: 1, displayOrder: 1 }
    ]);
    expect(ids).toEqual([1, 2, 3]);
  });
});
