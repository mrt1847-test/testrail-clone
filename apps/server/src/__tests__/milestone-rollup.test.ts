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

describe("milestone summary hierarchy rollup API", () => {
  it("rolls child milestone runs into parent summary and dashboard", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Milestone rollup project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const parentRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/milestones`,
      headers,
      payload: { name: "Release train" }
    });
    const parentId = (parentRes.json() as { data: { id: string } }).data.id;

    const childRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/milestones`,
      headers,
      payload: { name: "Sprint A", parentMilestoneId: parentId }
    });
    const childId = (childRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Child milestone run", includeAll: true, milestoneId: childId }
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

    await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/results`,
      headers,
      payload: { status: "passed" }
    });

    const summaryRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/milestone-summary`,
      headers
    });
    expect(summaryRes.statusCode).toBe(200);
    const body = summaryRes.json() as {
      data: {
        items: Array<{
          milestoneId: string;
          runCount: number;
          total: number;
          passed: number;
          includesSubMilestones: boolean;
          childCount: number;
        }>;
        dashboard: { linkedRunCount: number; topMilestones: Array<{ milestoneId: string }> };
      };
    };

    const parent = body.data.items.find((row) => row.milestoneId === parentId);
    const child = body.data.items.find((row) => row.milestoneId === childId);
    expect(parent).toMatchObject({
      childCount: 1,
      runCount: 1,
      includesSubMilestones: true
    });
    expect(child).toMatchObject({
      runCount: 1,
      includesSubMilestones: false
    });
    expect(parent?.total).toBe(child?.total);
    expect(parent?.passed).toBeGreaterThanOrEqual(1);
    expect(body.data.dashboard.linkedRunCount).toBe(1);
    expect(body.data.dashboard.topMilestones[0]?.milestoneId).toBe(parentId);
  });
});
