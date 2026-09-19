import { describe, expect, it } from "vitest";

import { buildRunCaseInstructionModel } from "./runCaseInstructionModel";

describe("buildRunCaseInstructionModel", () => {
  it("keeps common expected results when structured steps exist", () => {
    const model = buildRunCaseInstructionModel({
      preconditions: "User is on the login page\nNetwork is available",
      expectedResult: "The session cookie is set",
      steps: [
        { stepOrder: 1, description: "Enter a valid email", expected: "Email is accepted" },
        { stepOrder: 2, description: "Enter the password", expected: "Password is accepted" },
        { stepOrder: 3, description: "Submit the form", expected: "Dashboard opens" }
      ]
    });
    expect(model.preconditions).toContain("login page");
    expect(model.steps).toHaveLength(3);
    expect(model.steps[0]).toEqual({ order: 1, action: "Enter a valid email", expected: "Email is accepted" });
    expect(model.commonExpected).toBe("The session cookie is set");
    expect(model.textInstructions).toBeNull();
    expect(model.isEmpty).toBe(false);
  });

  it("renders Text-template guidance as prose instead of an empty step list", () => {
    const model = buildRunCaseInstructionModel({
      preconditions: "Use a trial account",
      expectedResult: "Invoice PDF downloads",
      steps: []
    });
    expect(model.steps).toEqual([]);
    expect(model.textInstructions).toBe("Invoice PDF downloads");
    expect(model.commonExpected).toBeNull();
    expect(model.isEmpty).toBe(false);
  });

  it("keeps Text steps and Expected result distinct when a prose step is persisted", () => {
    const model = buildRunCaseInstructionModel(
      {
        preconditions: "Use a trial account",
        expectedResult: "Invoice PDF downloads",
        steps: [{ description: "Open the confirmation mail and choose Download invoice", expected: null }]
      },
      { usesStructuredSteps: false }
    );
    expect(model.steps).toEqual([]);
    expect(model.textInstructions).toBe("Open the confirmation mail and choose Download invoice");
    expect(model.commonExpected).toBe("Invoice PDF downloads");
  });

  it("distinguishes an unwritten case from exploratory or BDD guidance", () => {
    expect(buildRunCaseInstructionModel({}).isEmpty).toBe(true);
    expect(
      buildRunCaseInstructionModel({
        mission: "Probe password reset",
        goals: "Find account lockouts"
      }).isEmpty
    ).toBe(false);
    expect(
      buildRunCaseInstructionModel({
        scenarios: [{ name: "Valid login", content: "Given a user\nWhen they sign in\nThen they see home" }]
      }).scenarios
    ).toHaveLength(1);
  });
});
