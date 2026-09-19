import { describe, expect, it } from "vitest";

import { caseDetailPanelTitle, caseDetailUtilityMenuGroups } from "./caseDetailPanelHeader";

describe("caseDetailPanelHeader", () => {
  it("puts the case title first instead of a generic details heading", () => {
    expect(caseDetailPanelTitle("C1", "Valid login")).toBe("C1 Valid login");
    expect(caseDetailPanelTitle(null, null)).toBe("Test case");
  });

  it("keeps copy, full-page, and print off the primary Edit/Close row", () => {
    const groups = caseDetailUtilityMenuGroups({
      projectId: "1",
      caseId: 12,
      sectionId: 3,
      isEditing: false
    });
    const ids = groups.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toEqual(["copy-id", "copy-link", "open-page", "print"]);
    expect(ids).not.toContain("edit");
    expect(ids).not.toContain("close");
    const openPage = groups.flatMap((group) => group.items).find((item) => item.id === "open-page");
    expect(openPage?.to).toBe("/projects/1/cases/12?sectionId=3");
  });
});
