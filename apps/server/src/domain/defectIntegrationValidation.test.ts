import { describe, expect, it } from "vitest";

import {
  normalizeDefectProvider,
  testDefectIntegrationConnection,
  validateDefectIntegrationConfig,
  validateIssueUrlTemplate
} from "./defectIntegrationValidation.js";

describe("defectIntegrationValidation", () => {
  it("normalizes provider aliases", () => {
    expect(normalizeDefectProvider("Azure DevOps")).toBe("azure_devops");
    expect(normalizeDefectProvider("JIRA")).toBe("jira");
    expect(normalizeDefectProvider("unknown")).toBe("custom");
  });

  it("requires {key} in template", () => {
    expect(validateIssueUrlTemplate("https://jira.example/browse/QA-1")).toContain("{key}");
    expect(validateIssueUrlTemplate("https://jira.example/browse/{key}")).toBeNull();
  });

  it("fails when enabled without template", () => {
    const result = validateDefectIntegrationConfig({
      provider: "jira",
      isEnabled: true,
      issueUrlTemplate: null,
      defaultProjectKey: "QA"
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/template/i);
  });

  it("passes connection test with sample URL", () => {
    const result = testDefectIntegrationConnection({
      provider: "jira",
      isEnabled: true,
      issueUrlTemplate: "https://jira.example/browse/{key}",
      defaultProjectKey: "QA"
    });
    expect(result.ok).toBe(true);
    expect(result.sampleUrls[0]?.url).toBe("https://jira.example/browse/QA-1");
    expect(result.checks.some((row) => row.code === "connection" && row.status === "pass")).toBe(true);
  });
});
