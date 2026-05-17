import { describe, expect, it } from "vitest";
import {
  customValuesFromJson,
  normalizeFieldType,
  sanitizeCustomFieldValue,
  sanitizeCustomFieldMap,
  isSystemTemplateFieldType,
  CustomFieldValidationError
} from "./customFieldTypes.js";

describe("customFieldTypes", () => {
  it("normalizes TestRail type names", () => {
    expect(normalizeFieldType("Checkbox")).toBe("checkbox");
    expect(normalizeFieldType("Multi-select")).toBe("multi_select");
    expect(normalizeFieldType("Step Results")).toBe("step_results");
    expect(normalizeFieldType("select")).toBe("dropdown");
  });

  it("validates date, url, integer, and rating", () => {
    expect(
      sanitizeCustomFieldValue(
        { systemName: "due", fieldType: "date", options: [], isRequired: false },
        "2026-05-17"
      )
    ).toBe("2026-05-17");
    expect(
      sanitizeCustomFieldValue(
        { systemName: "link", fieldType: "url", options: [], isRequired: false },
        "https://example.com/path"
      )
    ).toBe("https://example.com/path");
    expect(
      sanitizeCustomFieldValue(
        { systemName: "count", fieldType: "integer", options: [], isRequired: false },
        3
      )
    ).toBe(3);
    expect(
      sanitizeCustomFieldValue(
        { systemName: "score", fieldType: "rating", options: ["5"], isRequired: false },
        4
      )
    ).toBe(4);
  });

  it("rejects system template values in customValues", () => {
    expect(() =>
      sanitizeCustomFieldValue(
        { systemName: "steps", fieldType: "steps", options: [], isRequired: false },
        "anything"
      )
    ).toThrow(CustomFieldValidationError);
    expect(isSystemTemplateFieldType("Scenarios")).toBe(true);
  });

  it("parses multi-select arrays from stored JSON", () => {
    expect(customValuesFromJson({ tags: ["A", "B"], risk: "High" })).toEqual({
      tags: ["A", "B"],
      risk: "High"
    });
  });

  it("sanitizes multi-select and dropdown options", () => {
    const map = sanitizeCustomFieldMap(
      [
        { systemName: "tags", fieldType: "multi_select", options: ["A", "B"], isRequired: false },
        { systemName: "risk", fieldType: "dropdown", options: ["Low", "High"], isRequired: true }
      ],
      { tags: ["A", "B"], risk: "High" }
    );
    expect(map.tags).toEqual(["A", "B"]);
    expect(map.risk).toBe("High");
  });
});
