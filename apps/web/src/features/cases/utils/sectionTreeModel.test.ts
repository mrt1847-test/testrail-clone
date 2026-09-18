import { describe, expect, it } from "vitest";

import { sectionMoveDestinations, sectionPathLabel } from "./sectionTreeModel";

const sections = [
  { id: 1, name: "Authentication", parentSectionId: null, displayOrder: 1 },
  { id: 2, name: "Login", parentSectionId: 1, displayOrder: 1 },
  { id: 3, name: "MFA", parentSectionId: 1, displayOrder: 2 },
  { id: 4, name: "Checkout", parentSectionId: null, displayOrder: 2 }
];

describe("section tree model", () => {
  it("builds a readable hierarchy path", () => {
    expect(sectionPathLabel(sections, 2)).toBe("Authentication / Login");
  });

  it("excludes the source and descendants from move destinations", () => {
    expect(sectionMoveDestinations(sections, 1)).toEqual([
      { id: null, label: "Root level" },
      { id: 4, label: "Checkout" }
    ]);
  });
});
