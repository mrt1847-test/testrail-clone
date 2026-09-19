import { describe, expect, it } from "vitest";

import { buildProjectContextMenu, projectContextMenuLabel } from "./projectContextMenu";

describe("projectContextMenu", () => {
  it("labels the trigger with the pinned suite when one is set", () => {
    expect(projectContextMenuLabel(undefined)).toBe("Suite");
    expect(projectContextMenuLabel("Master")).toBe("Suite: Master");
  });

  it("marks the pinned default suite and keeps settings in the menu", () => {
    const groups = buildProjectContextMenu({
      projectId: "1",
      suites: [{ id: "10", name: "Master" }],
      pinnedSuiteId: "10",
      onPinSuite: () => undefined
    });
    expect(groups[0]?.items.map((item) => ({ id: item.id, selected: item.selected }))).toEqual([
      { id: "none", selected: false },
      { id: "10", selected: true }
    ]);
    expect(groups[1]?.items[0]).toMatchObject({
      id: "settings",
      to: "/projects/1/settings"
    });
  });
});
