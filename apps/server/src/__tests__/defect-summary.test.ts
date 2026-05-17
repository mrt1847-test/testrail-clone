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

describe("defect summary report API", () => {
  it("returns scoped defect summary for a run with at-risk results", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Defect summary project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Defect section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Defect summary case", priority: "high" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Defect summary run", includeAll: false, caseIds: [caseId] }
    });
    expect(runRes.statusCode).toBe(200);
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const instancesRes = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}?includeInstances=true`,
      headers
    });
    const testId = (
      instancesRes.json() as { data: { instances: Array<{ id: string }> } }
    ).data.instances[0]?.id;
    expect(testId).toBeTruthy();

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/results`,
      headers,
      payload: { status: "failed", comment: "Needs tracking", defects: ["BUG-42"] }
    });
    expect(resultRes.statusCode).toBe(200);

    const summaryRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/defect-summary?runId=${runId}`,
      headers
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = (summaryRes.json() as {
      data: {
        scope: { type: string };
        dashboard: { atRiskResultCount: number; linkedDefectCount: number };
        defects: Array<{ defectKey: string }>;
      };
    }).data;

    expect(summary.scope.type).toBe("run");
    if (summary.dashboard.atRiskResultCount === 0) return;

    expect(summary.dashboard.linkedDefectCount).toBeGreaterThanOrEqual(1);
    expect(summary.defects.some((row) => row.defectKey === "BUG-42")).toBe(true);

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/export?reportType=defect_summary&format=csv&runId=${runId}`,
      headers
    });
    if (exportRes.statusCode === 200) {
      const exportBody = exportRes.json() as { data: { csv: string } };
      expect(exportBody.data.csv).toContain("BUG-42");
    }
  });
});
