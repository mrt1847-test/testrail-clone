import { describe, expect, it } from "vitest";

import { caseRowWithExploratoryFields, normalizeExploratoryCaseFields } from "./exploratoryCaseFields.js";

describe("exploratoryCaseFields", () => {
  it("lifts legacy mission/goals from customValues into columns", () => {
    const normalized = normalizeExploratoryCaseFields({
      customValues: { mission: " Explore checkout ", goals: "Find edge cases" }
    });
    expect(normalized.mission).toBe("Explore checkout");
    expect(normalized.goals).toBe("Find edge cases");
    expect(normalized.customValues).toEqual({});
  });

  it("prefers explicit mission/goals over customValues", () => {
    const normalized = normalizeExploratoryCaseFields({
      mission: "Primary mission",
      goals: "Primary goals",
      customValues: { mission: "Legacy", goals: "Legacy goals" }
    });
    expect(normalized.mission).toBe("Primary mission");
    expect(normalized.goals).toBe("Primary goals");
    expect(normalized.customValues).toEqual({});
  });

  it("strips exploratory keys from API customValues", () => {
    const row = caseRowWithExploratoryFields({
      mission: "Charter",
      goals: "Coverage",
      customValues: { mission: "old", env: "prod" }
    });
    expect(row.mission).toBe("Charter");
    expect(row.goals).toBe("Coverage");
    expect(row.customValues).toEqual({ env: "prod" });
  });
});
