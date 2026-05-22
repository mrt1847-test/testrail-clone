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

describe("run summary report export filters", () => {
  it("exports only runs matching lifecycle and name filters", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Run summary export filters project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Export section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Export case" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const openRunRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Alpha open run", includeAll: false, caseIds: [caseId] }
    });
    const openRunId = (openRunRes.json() as { run: { id: string } }).run.id;

    const closedRunRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Beta closed run", includeAll: false, caseIds: [caseId] }
    });
    const closedRunId = (closedRunRes.json() as { run: { id: string } }).run.id;

    await app.inject({
      method: "POST",
      url: `/api/runs/${closedRunId}/close`,
      headers
    });

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/export?reportType=run_summary&format=csv&q=Alpha&runLifecycleStatus=open`,
      headers
    });
    if (exportRes.statusCode !== 200) {
      expect(exportRes.statusCode).toBe(501);
      return;
    }
    const csv = (exportRes.json() as { data: { csv: string } }).data.csv;
    expect(csv).toContain("Alpha open run");
    expect(csv).not.toContain("Beta closed run");
    expect(csv).toContain(openRunId);
    expect(csv).not.toContain(closedRunId);
  });
});
