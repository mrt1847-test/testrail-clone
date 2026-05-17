import { describe, expect, it } from "vitest";

import {
  extractResultCustomFieldFilters,
  matchesResultCustomFieldFilter,
  operatorsForResultFieldType,
  parseResultCustomFieldFilterInput
} from "./resultCustomFieldFilters.js";

describe("resultCustomFieldFilters", () => {
  it("exposes operators per field type", () => {
    expect(operatorsForResultFieldType("text")).toContain("contains");
    expect(operatorsForResultFieldType("number")).toContain("gte");
    expect(operatorsForResultFieldType("multi_select")).toContain("contains");
    expect(operatorsForResultFieldType("checkbox")).not.toContain("contains");
  });

  it("parses legacy exact value as eq", () => {
    expect(parseResultCustomFieldFilterInput("risk", "High", undefined)).toEqual({
      systemName: "risk",
      operator: "eq",
      value: "High"
    });
  });

  it("parses operator query params", () => {
    const filters = extractResultCustomFieldFilters({
      custom_env_op: "contains",
      custom_env: "staging",
      custom_score_op: "gte",
      custom_score: "3"
    });
    expect(filters).toEqual([
      { systemName: "env", operator: "contains", value: "staging" },
      { systemName: "score", operator: "gte", value: "3" }
    ]);
  });

  it("matches contains and empty operators", () => {
    expect(
      matchesResultCustomFieldFilter("Production env", "text", {
        systemName: "env",
        operator: "contains",
        value: "prod"
      })
    ).toBe(true);
    expect(
      matchesResultCustomFieldFilter(null, "text", {
        systemName: "env",
        operator: "empty",
        value: ""
      })
    ).toBe(true);
    expect(
      matchesResultCustomFieldFilter("x", "text", {
        systemName: "env",
        operator: "empty",
        value: ""
      })
    ).toBe(false);
  });

  it("matches numeric comparisons", () => {
    expect(
      matchesResultCustomFieldFilter(4, "integer", {
        systemName: "score",
        operator: "gte",
        value: "3"
      })
    ).toBe(true);
    expect(
      matchesResultCustomFieldFilter(2, "integer", {
        systemName: "score",
        operator: "lt",
        value: "3"
      })
    ).toBe(true);
  });

  it("matches multi-select contains", () => {
    expect(
      matchesResultCustomFieldFilter(["a", "b"], "multi_select", {
        systemName: "tags",
        operator: "contains",
        value: "b"
      })
    ).toBe(true);
    expect(
      matchesResultCustomFieldFilter(["a"], "multi_select", {
        systemName: "tags",
        operator: "not_contains",
        value: "b"
      })
    ).toBe(true);
  });
});
