import { describe, expect, it } from "vitest";

import { buildRunSelectionActionBarModel } from "./runSelectionActionBarModel";

describe("buildRunSelectionActionBarModel", () => {
  it("hides the contextual action bar when no tests are selected", () => {
    expect(
      buildRunSelectionActionBarModel({
        selectedCount: 0,
        totalMatching: 18,
        allFilteredSelected: false,
        commentVisible: false
      })
    ).toBeNull();
  });

  it("exposes selected count after the first selected test", () => {
    const model = buildRunSelectionActionBarModel({
      selectedCount: 1,
      totalMatching: 18,
      allFilteredSelected: false,
      commentVisible: false
    });

    expect(model?.selectedLabel).toBe("1 selected");
  });

  it("keeps secondary selection actions in one overflow group", () => {
    const model = buildRunSelectionActionBarModel({
      selectedCount: 3,
      totalMatching: 18,
      allFilteredSelected: false,
      commentVisible: false
    });

    expect(model?.selectedLabel).toBe("3 selected");
    expect(model?.overflowItems.map((item) => item.id)).toEqual([
      "add-comment",
      "select-all-matching",
      "assign-to-me",
      "clear-assignees"
    ]);
  });

  it("does not offer select-all when every matching test is already selected", () => {
    const model = buildRunSelectionActionBarModel({
      selectedCount: 18,
      totalMatching: 18,
      allFilteredSelected: true,
      commentVisible: true
    });

    expect(model?.overflowItems.map((item) => item.id)).toEqual([
      "hide-comment",
      "assign-to-me",
      "clear-assignees"
    ]);
  });
});
