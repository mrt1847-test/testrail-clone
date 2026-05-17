import { describe, expect, it } from "vitest";

import {
  assertWritableCustomValueKeys,
  canEditCustomField,
  canViewCustomField,
  filterCustomValuesForRead,
  parseVisibilityRules
} from "./customFieldVisibility.js";
import { CustomFieldValidationError } from "./customFieldTypes.js";

const ctx = (role: "owner" | "manager" | "tester" | "viewer", templateId?: string | null) => ({
  role,
  templateId: templateId ?? null,
  scope: "case" as const
});

describe("customFieldVisibility", () => {
  it("allows all roles and templates when rules are empty", () => {
    const rules = parseVisibilityRules(null);
    expect(canViewCustomField(rules, ctx("viewer", "1"))).toBe(true);
    expect(canEditCustomField(rules, ctx("viewer", "1"))).toBe(true);
  });

  it("denies view when role is not listed", () => {
    const rules = { viewRoles: ["owner", "manager"] as ("owner" | "manager")[] };
    expect(canViewCustomField(rules, ctx("tester"))).toBe(false);
    expect(canViewCustomField(rules, ctx("manager"))).toBe(true);
  });

  it("denies view when template is not listed", () => {
    const rules = { templateIds: ["10", "20"] };
    expect(canViewCustomField(rules, ctx("owner", "99"))).toBe(false);
    expect(canViewCustomField(rules, ctx("owner", "10"))).toBe(true);
  });

  it("denies edit when editRoles is stricter than view", () => {
    const rules = {
      viewRoles: ["tester", "viewer"] as ("tester" | "viewer")[],
      editRoles: ["tester"] as "tester"[]
    };
    expect(canViewCustomField(rules, ctx("viewer"))).toBe(true);
    expect(canEditCustomField(rules, ctx("viewer"))).toBe(false);
    expect(canEditCustomField(rules, ctx("tester"))).toBe(true);
  });

  it("strips hidden values on read", () => {
    const fields = [
      { systemName: "public", visibility: {} },
      { systemName: "secret", visibility: { viewRoles: ["owner"] } }
    ];
    const filtered = filterCustomValuesForRead(
      { public: "ok", secret: "hidden" },
      fields,
      ctx("tester")
    );
    expect(filtered).toEqual({ public: "ok" });
  });

  it("rejects writes to non-editable keys", () => {
    const fields = [{ systemName: "risk", visibility: { editRoles: ["manager"] } }];
    expect(() =>
      assertWritableCustomValueKeys({ risk: "High" }, fields, ctx("tester"))
    ).toThrow(CustomFieldValidationError);
  });
});
