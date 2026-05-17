import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getMasterSuiteId } from "./testProjectSuites.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("defect provider API baseline", () => {
  async function login() {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    return (loginRes.json() as { token: string }).token;
  }

  it("returns template preview for draft settings", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Template preview project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const previewRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/integrations/defects/template-preview?provider=jira&createMode=provider_api&issueUrlTemplate=https://jira.example/browse/{key}&defaultProjectKey=QA&sampleIssueKey=QA-7`,
      headers
    });
    expect(previewRes.statusCode).toBe(200);
    const preview = (previewRes.json() as { data: { url: string; createMode: string } }).data;
    expect(preview.createMode).toBe("provider_api");
    expect(preview.url).toBe("https://jira.example/browse/QA-7");
  });

  it("pushes via provider API mode with remote status snapshot and sync refresh", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Provider API push project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/integrations/defects`,
      headers,
      payload: {
        provider: "jira",
        isEnabled: true,
        createMode: "provider_api",
        issueUrlTemplate: "https://jira.example/browse/{key}",
        defaultProjectKey: "QA"
      }
    });

    const suiteId = await getMasterSuiteId(app, projectId, headers);
    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Provider API section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Provider API case" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Provider API run", includeAll: false, caseIds: [caseId] }
    });
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const instancesRes = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}?includeInstances=true`,
      headers
    });
    const testId = (
      instancesRes.json() as { data: { instances: Array<{ id: string }> } }
    ).data.instances[0]?.id;

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/results`,
      headers,
      payload: { status: "failed", comment: "API regression" }
    });
    const resultId = (resultRes.json() as { id: string }).id;

    const pushRes = await app.inject({
      method: "POST",
      url: `/api/results/${resultId}/defects/push`,
      headers,
      payload: {
        provider: "jira",
        title: "Checkout failed",
        description: "Traceback in logs"
      }
    });
    expect(pushRes.statusCode).toBe(200);
    const pushed = (
      pushRes.json() as {
        data: {
          defectKey: string;
          remoteStatus: string;
          remoteStatusLabel: string;
        };
      }
    ).data;
    expect(pushed.defectKey.startsWith("QA-")).toBe(true);
    expect(pushed.remoteStatus).toBe("open");
    expect(pushed.remoteStatusLabel).toBe("Open");

    const listRes = await app.inject({
      method: "GET",
      url: `/api/results/${resultId}/defects`,
      headers
    });
    const links = listRes.json() as Array<{ id: string; remoteStatus: string }>;
    const linkId = links[0]?.id;
    expect(linkId).toBeTruthy();

    const syncRes = await app.inject({
      method: "POST",
      url: `/api/results/${resultId}/defects/${linkId}/sync`,
      headers
    });
    expect(syncRes.statusCode).toBe(200);
    const synced = (syncRes.json() as { data: { remoteStatusLabel: string } }).data;
    expect(synced.remoteStatusLabel.length).toBeGreaterThan(0);
  });
});
