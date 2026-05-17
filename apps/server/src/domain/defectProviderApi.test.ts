import { describe, expect, it } from "vitest";

import {
  buildDefectTemplatePreview,
  createProviderIssue,
  syncProviderIssueStatus
} from "./defectProviderApi.js";

describe("defectProviderApi", () => {
  const setting = {
    provider: "jira",
    isEnabled: true,
    createMode: "provider_api",
    issueUrlTemplate: "https://jira.example/browse/{key}",
    defaultProjectKey: "QA",
    apiBaseUrl: null,
    apiToken: null
  };

  it("builds template preview with resolved sample URL", () => {
    const preview = buildDefectTemplatePreview(setting, "QA-42");
    expect(preview.url).toBe("https://jira.example/browse/QA-42");
    expect(preview.createMode).toBe("provider_api");
    expect(preview.fieldHints).toContain("summary");
  });

  it("creates a simulated provider issue with status snapshot", async () => {
    const created = await createProviderIssue(setting, {
      title: "Login failed",
      description: "Steps to reproduce"
    });
    expect(created.defectKey.startsWith("QA-")).toBe(true);
    expect(created.remoteStatus).toBe("open");
    expect(created.providerIssueId).toContain("jira:");
    expect(created.usedRemoteApi).toBe(false);
  });

  it("syncs remote status snapshot for an existing key", async () => {
    const synced = await syncProviderIssueStatus(setting, {
      defectKey: "QA-99",
      providerIssueId: "jira:QA-99"
    });
    expect(synced.remoteStatusLabel.length).toBeGreaterThan(0);
    expect(synced.syncedAt).toBeInstanceOf(Date);
  });
});
