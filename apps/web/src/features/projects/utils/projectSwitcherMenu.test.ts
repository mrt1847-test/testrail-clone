import { describe, expect, it, vi } from "vitest";

import { buildProjectSwitcherMenu, projectSwitcherLabel } from "./projectSwitcherMenu";

describe("projectSwitcherMenu", () => {
  it("keeps a single current-project label and marks archived context", () => {
    expect(projectSwitcherLabel("UI-041 Navigation")).toBe("UI-041 Navigation");
    expect(projectSwitcherLabel("UI-041 Navigation", true)).toBe("UI-041 Navigation (Archived)");
  });

  it("moves project chips into a named menu with pin and all-projects actions", () => {
    const onTogglePin = vi.fn();
    const groups = buildProjectSwitcherMenu({
      currentProjectId: "2",
      currentProjectName: "UI-041 Navigation",
      pinned: [{ id: "2", name: "UI-041 Navigation" }],
      others: [
        { id: "3", name: "Other Product With A Very Long Project Name For Truncation" },
        { id: "1", name: "UI-042 Chrome", isArchived: true }
      ],
      isCurrentPinned: true,
      onTogglePin
    });

    expect(groups.map((group) => group.id)).toEqual(["pinned", "projects", "actions"]);
    expect(groups[0]?.items[0]).toMatchObject({
      id: "2",
      selected: true,
      to: "/projects/2",
      description: "Current"
    });
    expect(groups[1]?.items[1]).toMatchObject({
      id: "1",
      to: "/projects/1",
      description: "Archived"
    });
    expect(groups[2]?.items.map((item) => item.id)).toEqual(["pin-current", "all-projects"]);
    groups[2]?.items[0]?.onSelect?.();
    expect(onTogglePin).toHaveBeenCalledWith("2");
  });
});
