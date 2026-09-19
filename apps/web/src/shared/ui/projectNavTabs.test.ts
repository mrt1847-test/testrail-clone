import { describe, expect, it } from "vitest";

import {
  buildProjectNavTabs,
  currentProjectNavTab,
  projectNavLocationLabel
} from "./projectNavTabs";

describe("projectNavTabs", () => {
  const tabs = buildProjectNavTabs("2");

  it("keeps every existing primary and secondary route", () => {
    expect(tabs.filter((tab) => tab.group === "primary").map((tab) => tab.label)).toEqual([
      "Overview",
      "Test Cases",
      "Test Runs & Results",
      "Milestones",
      "Reports",
      "My Tests",
      "Settings"
    ]);
    expect(tabs.filter((tab) => tab.group === "secondary").map((tab) => tab.label)).toEqual([
      "Test Plans",
      "Team Todo",
      "Result Explorer",
      "Activity",
      "Automation",
      "Import/Export",
      "Shared Steps"
    ]);
  });

  it("marks Test Runs & Results as the execution area for run and plan routes", () => {
    expect(currentProjectNavTab("/projects/2/runs", tabs)?.label).toBe("Test Runs & Results");
    expect(currentProjectNavTab("/projects/2/runs/9", tabs)?.label).toBe("Test Runs & Results");
    expect(currentProjectNavTab("/projects/2/plans", tabs)?.label).toBe("Test Runs & Results");
    expect(currentProjectNavTab("/projects/2/plans/4", tabs)?.label).toBe("Test Runs & Results");
  });

  it("names the narrow current-location control from the active route", () => {
    expect(projectNavLocationLabel(currentProjectNavTab("/projects/2/cases", tabs))).toBe(
      "Go to: Test Cases"
    );
    expect(currentProjectNavTab("/projects/2/settings/members", tabs)?.label).toBe("Settings");
    expect(currentProjectNavTab("/projects/2/team-todo", tabs)?.label).toBe("Team Todo");
    expect(currentProjectNavTab("/projects/2", tabs)?.label).toBe("Overview");
  });
});
