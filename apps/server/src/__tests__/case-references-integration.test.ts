import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("case references integration", () => {
  async function login() {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "refs-integration@example.com", password: "password" }
    });
    return (loginRes.json() as { token: string }).token;
  }

  it("resolves reference URLs when defect integration is enabled", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Refs URL project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/integrations/defects`,
      headers,
      payload: {
        isEnabled: true,
        issueUrlTemplate: "https://jira.example/browse/{key}",
        defaultProjectKey: "QA"
      }
    });

    const urlsRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/integrations/defects/reference-urls?keys=QA-42,REQ-1`,
      headers
    });
    expect(urlsRes.statusCode).toBe(200);
    const body = urlsRes.json() as {
      data: { integrationEnabled: boolean; items: Array<{ key: string; url: string | null }> };
    };
    expect(body.data.integrationEnabled).toBe(true);
    expect(body.data.items).toEqual(
      expect.arrayContaining([
        { key: "QA-42", url: "https://jira.example/browse/QA-42" },
        { key: "REQ-1", url: "https://jira.example/browse/REQ-1" }
      ])
    );
  });

  it("returns issue search suggestions when integration is active", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Refs search project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/integrations/defects`,
      headers,
      payload: {
        isEnabled: true,
        issueUrlTemplate: "https://jira.example/browse/{key}",
        defaultProjectKey: "QA"
      }
    });

    const searchRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/integrations/defects/issues/search?q=QA&limit=3`,
      headers
    });
    expect(searchRes.statusCode).toBe(200);
    const search = searchRes.json() as {
      data: { integrationEnabled: boolean; items: Array<{ key: string; url: string | null }> };
    };
    expect(search.data.integrationEnabled).toBe(true);
    expect(search.data.items.length).toBeGreaterThan(0);
    expect(search.data.items[0]?.key).toMatch(/^QA-/);
    expect(search.data.items[0]?.url).toContain("jira.example");
  });

  it("rejects oversized refs on case create", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Refs validation project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/suites`,
      headers,
      payload: { name: "Suite" }
    });
    const suiteId = (suiteRes.json() as { data: { id: string } }).data.id;

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const createRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Bad refs", refs: "x".repeat(5000) }
    });
    expect(createRes.statusCode).toBe(400);
    expect(createRes.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
