import { describe, expect, it } from "vitest";

import {
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
});
