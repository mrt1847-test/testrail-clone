import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getMasterSuiteId } from "./testProjectSuites.js";

const app = buildApp();

async function login() {
  const loginRes = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@example.com", password: "password" }
  });
  return (loginRes.json() as { token: string }).token;
}

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("plan entry semantics API", () => {
  it("stores plan defaults, entry include/exclude, and configuration combinations", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Plan semantics project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const meRes = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    const userId = (meRes.json() as { user: { id: string } }).user.id;

    const planRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plans`,
      headers,
      payload: {
        name: "Release matrix",
        assignedTo: userId,
        refs: "REQ-100",
        startDate: "2026-06-01T00:00:00.000Z",
        dueOn: "2026-06-30T00:00:00.000Z"
      }
    });
    const planId = (planRes.json() as { data: { id: string; assignedTo: string } }).data.id;
    expect((planRes.json() as { data: { assignedTo: string } }).data.assignedTo).toBe(userId);

    const suiteId = await getMasterSuiteId(app, projectId, headers);
    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Plan semantics section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseARes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Included case" }
    });
    const caseAId = (caseARes.json() as { data: { id: string } }).data.id;

    const caseBRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Excluded case" }
    });
    const caseBId = (caseBRes.json() as { data: { id: string } }).data.id;

    const groupRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/configuration-groups`,
      headers,
      payload: { name: "Browser" }
    });
    const groupId = (groupRes.json() as { data: { id: string } }).data.id;

    const configRes = await app.inject({
      method: "POST",
      url: `/api/configuration-groups/${groupId}/configurations`,
      headers,
      payload: { name: "Chrome" }
    });
    const configurationId = (configRes.json() as { data: { id: string } }).data.id;

    const entryRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plans/${planId}/entries`,
      headers,
      payload: {
        name: "Chrome smoke",
        suiteId,
        includeAll: true,
        excludeCaseIds: [caseBId],
        isIncluded: true,
        configurationIds: [configurationId]
      }
    });
    expect(entryRes.statusCode).toBe(200);
    const entry = (entryRes.json() as {
      data: { id: string; excludeCaseIds: string[] };
    }).data;
    expect(entry.excludeCaseIds).toContain(caseBId);

    const configGetRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/plans/${planId}/entries/${entry.id}/configurations`,
      headers
    });
    const mapped = (configGetRes.json() as { data: { configurationIds: string[] } }).data.configurationIds;
    expect(mapped).toContain(configurationId);

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plans/${planId}/runs`,
      headers,
      payload: { entryId: entry.id }
    });
    expect(runRes.statusCode).toBe(200);
    expect((runRes.json() as { data: { runId: string } }).data.runId).toBeTruthy();

    const excludedEntryRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plans/${planId}/entries`,
      headers,
      payload: { name: "Excluded entry", isIncluded: false }
    });
    const excludedEntryId = (excludedEntryRes.json() as { data: { id: string } }).data.id;

    const blockedRunRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plans/${planId}/runs`,
      headers,
      payload: { entryId: excludedEntryId }
    });
    expect(blockedRunRes.statusCode).toBe(400);
  });
});
