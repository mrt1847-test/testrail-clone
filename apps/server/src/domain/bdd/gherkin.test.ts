import { describe, expect, it } from "vitest";

import { parseGherkinFeatureText, serializeFeatureFile } from "./gherkin.js";

describe("gherkin parser", () => {
  it("parses feature and scenarios", () => {
    const parsed = parseGherkinFeatureText(`
Feature: Checkout
  Scenario: Guest checkout
    Given a guest cart
    When checkout is submitted
    Then order is created
  Scenario: Signed-in checkout
    Given a signed-in user
    When checkout is submitted
    Then order is created
`);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.name).toBe("Checkout");
    expect(parsed[0]!.scenarios).toHaveLength(2);
    expect(parsed[0]!.scenarios[0]!.content).toContain("Given a guest cart");
  });

  it("round-trips serialized feature text", () => {
    const text = serializeFeatureFile({
      featureName: "Login",
      scenarios: [
        {
          name: "Valid credentials",
          content: "Scenario: Valid credentials\n  Given valid user\n  Then login succeeds"
        }
      ]
    });
    const parsed = parseGherkinFeatureText(text);
    expect(parsed[0]!.scenarios[0]!.name).toBe("Valid credentials");
  });
});
