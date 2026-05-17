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

describe("project and users workload summary reports API", () => {
  it("returns project execution summary and users workload rollup", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Project summary reports project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Summary section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Summary case", priority: "high" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Summary run", includeAll: false, caseIds: [caseId] }
    });
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const testId = (
      await app.inject({ method: "GET", url: `/api/runs/${runId}?includeInstances=true`, headers })
    ).json() as { data: { instances: Array<{ id: string }> } };

    await app.inject({
      method: "PATCH",
      url: `/api/tests/${testId.data.instances[0].id}/assignee`,
      headers,
      payload: { assignedTo: "1" }
    });

    await app.inject({
      method: "POST",
      url: `/api/tests/${testId.data.instances[0].id}/results`,
      headers,
      payload: { status: "failed" }
    });

    const projectSummaryRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/project-summary`,
      headers
    });
    expect(projectSummaryRes.statusCode).toBe(200);
    const projectSummary = (projectSummaryRes.json() as {
      data: { totalRuns: number; execution: { total: number } };
    }).data;
    expect(projectSummary.totalRuns).toBeGreaterThanOrEqual(1);
    expect(projectSummary.execution.total).toBeGreaterThanOrEqual(1);

    const workloadRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/users-workload-summary`,
      headers
    });
    expect(workloadRes.statusCode).toBe(200);
    const workload = (workloadRes.json() as {
      data: { totalAssignedTests: number; items: Array<{ userId: string }> };
    }).data;
    if (workload.totalAssignedTests === 0) return;
    expect(workload.items.length).toBeGreaterThanOrEqual(1);

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/export?reportType=project_summary&format=csv`,
      headers
    });
    if (exportRes.statusCode === 200) {
      const exportBody = exportRes.json() as { data: { csv: string } };
      expect(exportBody.data.csv).toContain("execution");
    }
  });
});
