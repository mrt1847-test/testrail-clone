import { describe, expect, it } from "vitest";

import { buildCaseSelectionActionBarModel } from "./caseSelectionActionBarModel";

describe("buildCaseSelectionActionBarModel", () => {
  it("hides the bar when nothing is selected", () => {
    expect(
      buildCaseSelectionActionBarModel({
        selectedCount: 0,
        loadedCount: 6,
        allLoadedSelected: false,
        archiveMode: "archive"
      })
    ).toBeNull();
  });

  it("names the selected count and keeps print or delete in overflow", () => {
    const model = buildCaseSelectionActionBarModel({
      selectedCount: 2,
      loadedCount: 6,
      allLoadedSelected: false,
      archiveMode: "archive"
    });

    expect(model?.selectedLabel).toBe("2 selected");
    expect(model?.overflowItems.map((item) => item.id)).toEqual([
      "select-all-loaded",
      "print",
      "copy-move",
      "archive"
    ]);
    expect(model?.overflowItems.find((item) => item.id === "select-all-loaded")?.label).toBe(
      "Select all 6 loaded cases"
    );
  });

  it("does not offer select-all when every loaded case is already selected", () => {
    const model = buildCaseSelectionActionBarModel({
      selectedCount: 6,
      loadedCount: 6,
      allLoadedSelected: true,
      archiveMode: "restore"
    });

    expect(model?.overflowItems.map((item) => item.id)).toEqual([
      "print",
      "copy-move",
      "restore",
      "delete-permanent"
    ]);
  });
});
