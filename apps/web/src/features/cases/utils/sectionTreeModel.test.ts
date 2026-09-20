import { describe, expect, it } from "vitest";

import {
  sectionDestinationOptions,
  sectionMoveDestinations,
  sectionPathLabel
} from "./sectionTreeModel";

const sections = [
  { id: 1, name: "Authentication", parentSectionId: null, displayOrder: 1 },
  { id: 2, name: "Login", parentSectionId: 1, displayOrder: 1 },
  { id: 3, name: "MFA", parentSectionId: 1, displayOrder: 2 },
  { id: 4, name: "Checkout", parentSectionId: null, displayOrder: 2 },
  { id: 5, name: "Login", parentSectionId: 4, displayOrder: 1 },
  { id: 6, name: "Payment", parentSectionId: null, displayOrder: 3 },
  { id: 7, name: "General", parentSectionId: null, displayOrder: 0 }
];

describe("section tree model", () => {
  it("builds a readable hierarchy path", () => {
    expect(sectionPathLabel(sections, 2)).toBe("Authentication / Login");
    expect(sectionPathLabel(sections, 5)).toBe("Checkout / Login");
  });

  it("lists destinations with parent paths in tree order", () => {
    expect(sectionDestinationOptions(sections)).toEqual([
      { id: 7, label: "General" },
      { id: 1, label: "Authentication" },
      { id: 2, label: "Authentication / Login" },
      { id: 3, label: "Authentication / MFA" },
      { id: 4, label: "Checkout" },
      { id: 5, label: "Checkout / Login" },
      { id: 6, label: "Payment" }
    ]);
  });

  it("excludes the source and descendants from move destinations", () => {
    expect(sectionMoveDestinations(sections, 1)).toEqual([
      { id: null, label: "Root level" },
      { id: 7, label: "General" },
      { id: 4, label: "Checkout" },
      { id: 5, label: "Checkout / Login" },
      { id: 6, label: "Payment" }
    ]);
  });
});
