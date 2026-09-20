import { describe, expect, it } from "vitest";

import { authoringCustomValuesFromCase } from "./authoringCustomValuesFromCase";

describe("authoringCustomValuesFromCase", () => {
  it("lifts template fields into the authoring custom-value map", () => {
    expect(
      authoringCustomValuesFromCase({
        customValues: { severity: "high" },
        mission: "Explore checkout",
        goals: "Find payment gaps",
        aiInput: "prompt",
        aiExpectedOutput: "json"
      })
    ).toEqual({
      severity: "high",
      mission: "Explore checkout",
      goals: "Find payment gaps",
      ai_input: "prompt",
      ai_expected_output: "json"
    });
  });
});
