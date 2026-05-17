import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("defect integration connection test", () => {
  async function login() {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    return (loginRes.json() as { token: string }).token;
  }

  it("validates draft settings and returns sample URLs", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Defect integration test project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const testRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/integrations/defects/test-connection`,
      headers,
      payload: {
        provider: "jira",
        isEnabled: true,
        issueUrlTemplate: "https://jira.example/browse/{key}",
        defaultProjectKey: "QA"
      }
    });
    expect(testRes.statusCode).toBe(200);
    const body = testRes.json() as {
      data: { ok: boolean; provider: string; sampleUrls: Array<{ key: string; url: string }> };
    };
    expect(body.data.ok).toBe(true);
    expect(body.data.provider).toBe("jira");
    expect(body.data.sampleUrls[0]?.url).toBe("https://jira.example/browse/QA-1");
  });

  it("rejects save when enabled without a valid template", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Defect validation project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/integrations/defects`,
      headers,
      payload: {
        provider: "github",
        isEnabled: true,
        issueUrlTemplate: "not-a-url"
      }
    });
    expect(patchRes.statusCode).toBe(400);
    expect(patchRes.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("allows save after a passing connection test configuration", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Defect save project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/integrations/defects`,
      headers,
      payload: {
        provider: "azure_devops",
        isEnabled: true,
        issueUrlTemplate: "https://dev.azure.com/org/project/_workitems/edit/{key}",
        defaultProjectKey: "BUG"
      }
    });
    expect(patchRes.statusCode).toBe(200);
    const saved = (patchRes.json() as { data: { provider: string; isEnabled: boolean } }).data;
    expect(saved.provider).toBe("azure_devops");
    expect(saved.isEnabled).toBe(true);
  });
});
