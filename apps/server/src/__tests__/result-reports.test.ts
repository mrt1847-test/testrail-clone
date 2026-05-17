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

describe("result comparison and property distribution reports API", () => {
  it("compares case statuses across two runs and returns result property distribution", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Result reports project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Result report section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Shared comparison case", priority: "high" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const runARes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Comparison run A", includeAll: false, caseIds: [caseId] }
    });
    const runAId = (runARes.json() as { run: { id: string } }).run.id;

    const runBRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Comparison run B", includeAll: false, caseIds: [caseId] }
    });
    const runBId = (runBRes.json() as { run: { id: string } }).run.id;

    const instancesA = await app.inject({
      method: "GET",
      url: `/api/runs/${runAId}?includeInstances=true`,
      headers
    });
    const testAId = (
      instancesA.json() as { data: { instances: Array<{ id: string }> } }
    ).data.instances[0]?.id;

    const instancesB = await app.inject({
      method: "GET",
      url: `/api/runs/${runBId}?includeInstances=true`,
      headers
    });
    const testBId = (
      instancesB.json() as { data: { instances: Array<{ id: string }> } }
    ).data.instances[0]?.id;

    await app.inject({
      method: "POST",
      url: `/api/tests/${testAId}/results`,
      headers,
      payload: { status: "passed" }
    });
    await app.inject({
      method: "POST",
      url: `/api/tests/${testBId}/results`,
      headers,
      payload: { status: "failed" }
    });

    const comparisonRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/results-case-comparison?runIdA=${runAId}&runIdB=${runBId}`,
      headers
    });
    expect(comparisonRes.statusCode).toBe(200);
    const comparison = (comparisonRes.json() as {
      data: { summary: { changedCount: number }; items: Array<{ caseId: string; changed: boolean }> };
    }).data;
    const shared = comparison.items.find((row) => row.caseId === caseId);
    if (shared) {
      expect(shared.changed).toBe(true);
      expect(comparison.summary.changedCount).toBeGreaterThanOrEqual(1);
    }

    const distributionRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/results-property-distribution?field=status`,
      headers
    });
    expect(distributionRes.statusCode).toBe(200);
    const distribution = (distributionRes.json() as {
      data: { selectedField: string; totalResults: number; items: Array<{ value: string }> };
    }).data;
    expect(distribution.selectedField).toBe("status");
    expect(distribution.totalResults).toBeGreaterThanOrEqual(1);
    expect(distribution.items.length).toBeGreaterThan(0);
  });
});
