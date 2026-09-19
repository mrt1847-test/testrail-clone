import { describe, expect, it } from "vitest";

import {
  REPORT_ACTIONS_MENU_LABEL,
  REPORT_NAVIGATION_MENU_LABEL,
  reportDetailHeaderMenuGroups,
  reportResultMenuGroups,
  reportsCatalogHeaderMenuGroups
} from "./reportHeaderMenu";

describe("reportHeaderMenuGroups", () => {
  it("keeps saved/export admin out of the Add report slot", () => {
    const labels = reportsCatalogHeaderMenuGroups("p1").flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual(["Saved & exports"]);
    expect(labels).not.toContain("Add report");
    expect(labels).not.toContain("Run summary");
  });

  it("keeps export and print out of the drilldown header", () => {
    const labels = reportDetailHeaderMenuGroups("p1").flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toEqual(["All reports", "Saved & exports"]);
    expect(labels).not.toContain("Export CSV");
    expect(labels).not.toContain("Print view");
    expect(labels).not.toContain("Add report");
  });

  it("groups save, print, and export on the result overflow", () => {
    const groups = reportResultMenuGroups({
      printPath: "/print",
      onSaveView: () => undefined,
      onExportCsv: () => undefined,
      onQueueExport: () => undefined
    });
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));
    expect(groups.map((group) => group.label)).toEqual(["Views", "Output"]);
    expect(labels).toEqual(["Save view", "Print view", "Export CSV", "Queue export"]);
    expect(labels).not.toContain("Add report");
    expect(labels).not.toContain("All reports");
  });

  it("names navigation and current-report menus differently", () => {
    expect(REPORT_NAVIGATION_MENU_LABEL).toBe("Reports");
    expect(REPORT_ACTIONS_MENU_LABEL).toBe("This report");
    expect(REPORT_NAVIGATION_MENU_LABEL).not.toBe(REPORT_ACTIONS_MENU_LABEL);
  });

  it("does not offer print or enabled export when the report has no output", () => {
    const groups = reportResultMenuGroups({
      printPath: "/print",
      disabled: true,
      onSaveView: () => undefined,
      onExportCsv: () => undefined,
      onQueueExport: () => undefined
    });
    const items = groups.flatMap((group) => group.items);
    expect(items.map((item) => item.label)).toEqual(["Save view", "Export CSV", "Queue export"]);
    expect(items.find((item) => item.id === "print")).toBeUndefined();
    expect(items.find((item) => item.id === "csv")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "queue")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "save-view")?.disabled).not.toBe(true);
  });
});
