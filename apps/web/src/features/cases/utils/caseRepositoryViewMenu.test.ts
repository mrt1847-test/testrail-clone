import { describe, expect, it } from "vitest";

import { buildCaseRepositoryViewMenu } from "./caseRepositoryViewMenu";

const noop = () => undefined;

describe("case repository View menu", () => {
  const groups = buildCaseRepositoryViewMenu({
    groupByValue: "section_id",
    density: "comfortable",
    showDeleted: false,
    visibleColumnCount: 4,
    onGroupByChange: noop,
    onDensityChange: noop,
    onOpenColumnsAndViews: noop,
    onToggleArchived: noop,
    onExpandAllGroups: noop,
    onCollapseAllGroups: noop
  });

  it("does not offer a Display mode that restates grouping or a second Compact meaning", () => {
    expect(groups.map((group) => group.id)).toEqual(["group", "density", "section-blocks", "settings"]);
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));
    expect(labels.filter((label) => /compact/i.test(label))).toEqual(["Compact rows"]);
    expect(labels).not.toContain("Compact list");
    expect(labels).not.toContain("Section headers");
    expect(labels).not.toContain("Compact");
  });

  it("separates grouping from row spacing by the group and option labels", () => {
    expect(groups[0]?.label).toBe("Group cases");
    expect(groups[1]?.label).toBe("Row spacing");
    expect(groups[0]?.items.map((item) => item.label)).toEqual(["Section", "Priority", "Type", "No grouping"]);
    expect(groups[1]?.items.map((item) => item.label)).toEqual(["Compact rows", "Comfortable rows"]);
  });

  it("keeps columns and saved views behind one settings entry instead of listing every view", () => {
    const settings = groups.find((group) => group.id === "settings");
    expect(settings?.items.map((item) => item.id)).toEqual(["columns", "archived"]);
    expect(groups.find((group) => group.id === "saved-views")).toBeUndefined();
    expect(groups.find((group) => group.id === "display")).toBeUndefined();
  });
});
