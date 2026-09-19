import { describe, expect, it } from "vitest";

import { SETTINGS_ADMIN_MENU_LABEL, settingsAdminMenuGroups } from "./settingsHeaderMenu";

describe("settingsAdminMenuGroups", () => {
  it("names the settings overflow separately from the Settings tab", () => {
    expect(SETTINGS_ADMIN_MENU_LABEL).toBe("Administration");
  });

  it("keeps admin destinations out of the settings body", () => {
    const labels = settingsAdminMenuGroups("p1").flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toContain("Members & roles");
    expect(labels).toContain("API tokens");
    expect(labels).toContain("Defect integration");
    expect(labels).toContain("Notifications");
    expect(labels).not.toContain("Archive project");
    expect(labels).not.toContain("Default landing page");
  });
});
