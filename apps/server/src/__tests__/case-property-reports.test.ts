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

describe("case property reports API", () => {
  it("returns case property distribution and status tops", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Case property reports project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Property report section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "High priority case", priority: "high", caseType: "functional" }
    });

    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Medium priority case", priority: "medium", caseType: "regression" }
    });

    const distributionRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/cases-property-distribution?field=priority`,
      headers
    });
    expect(distributionRes.statusCode).toBe(200);
    const distribution = (distributionRes.json() as {
      data: { selectedField: string; totalCases: number; items: Array<{ value: string; count: number }> };
    }).data;
    expect(distribution.selectedField).toBe("priority");
    expect(distribution.totalCases).toBeGreaterThanOrEqual(2);
    expect(distribution.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "high", count: 1 }),
        expect.objectContaining({ value: "medium", count: 1 })
      ])
    );

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Status tops run", includeAll: true }
    });
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const statusRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/status-tops`,
      headers
    });
    expect(statusRes.statusCode).toBe(200);
    const statusTops = (statusRes.json() as {
      data: { totalTests: number; items: Array<{ status: string; count: number }> };
    }).data;
    expect(statusTops.totalTests).toBeGreaterThanOrEqual(2);
    expect(statusTops.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "untested", count: 2 })
      ])
    );
  });
});
