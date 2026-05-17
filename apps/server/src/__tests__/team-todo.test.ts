import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import { getMasterSuiteId } from "./testProjectSuites.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("team to-do API", () => {
  it.skipIf(!integrationEnabled)("lists team assignments with member and status filters", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const ownerHeaders = { authorization: `Bearer ${(loginRes.json() as { token: string }).token}` };

    const assigneeEmail = `team-todo-a-${Date.now()}@example.com`;
    const otherEmail = `team-todo-b-${Date.now()}@example.com`;

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: ownerHeaders,
      payload: { name: "Team todo project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    for (const email of [assigneeEmail, otherEmail]) {
      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/settings/members`,
        headers: ownerHeaders,
        payload: { email, role: "tester" }
      });
    }

    const membersRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/settings/members`,
      headers: ownerHeaders
    });
    const members = (membersRes.json() as { data: Array<{ email: string; userId: string }> }).data;
    const assigneeA = members.find((row) => row.email === assigneeEmail)?.userId;
    const assigneeB = members.find((row) => row.email === otherEmail)?.userId;
    expect(assigneeA && assigneeB).toBeTruthy();

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers: ownerHeaders,
      payload: { name: "Team run", includeAll: true }
    });
    const runId = (runRes.json() as { data: { id: string } }).data.id;

    const suiteId = await getMasterSuiteId(app, projectId, ownerHeaders);
    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers: ownerHeaders,
      payload: { name: "SEC" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseA = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers: ownerHeaders,
      payload: { title: "Case A" }
    });
    const caseB = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers: ownerHeaders,
      payload: { title: "Case B" }
    });
    const caseIdA = (caseA.json() as { data: { id: string } }).data.id;
    const caseIdB = (caseB.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/tests`,
      headers: ownerHeaders,
      payload: { caseIds: [caseIdA, caseIdB] }
    });

    const instancesRes = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}?includeInstances=true`,
      headers: ownerHeaders
    });
    const instances = (instancesRes.json() as { data: { instances: Array<{ id: string; caseId: string }> } }).data
      .instances;
    const testA = instances.find((row) => row.caseId === caseIdA)?.id;
    const testB = instances.find((row) => row.caseId === caseIdB)?.id;
    expect(testA && testB).toBeTruthy();

    await app.inject({
      method: "PATCH",
      url: `/api/tests/${testA}/assignee`,
      headers: ownerHeaders,
      payload: { assignedTo: assigneeA }
    });
    await app.inject({
      method: "PATCH",
      url: `/api/tests/${testB}/assignee`,
      headers: ownerHeaders,
      payload: { assignedTo: assigneeB }
    });

    const allRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/tests/team-todo?assigneeId=all`,
      headers: ownerHeaders
    });
    expect(allRes.statusCode).toBe(200);
    const allItems = (allRes.json() as { data: { items: Array<{ testId: string; assignee: { id: string } }> } }).data
      .items;
    expect(allItems.length).toBeGreaterThanOrEqual(2);
    expect(allItems.some((row) => row.testId === testA)).toBe(true);
    expect(allItems.some((row) => row.testId === testB)).toBe(true);

    const memberRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/tests/team-todo?assigneeId=${assigneeA}`,
      headers: ownerHeaders
    });
    const memberItems = (memberRes.json() as { data: { items: Array<{ testId: string }> } }).data.items;
    expect(memberItems.every((row) => row.testId === testA)).toBe(true);

    const viewerEmail = `team-todo-viewer-${Date.now()}@example.com`;
    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/settings/members`,
      headers: ownerHeaders,
      payload: { email: viewerEmail, role: "viewer" }
    });
    const viewerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: viewerEmail, password: "password" }
    });
    const viewerHeaders = { authorization: `Bearer ${(viewerLogin.json() as { token: string }).token}` };

    const viewerRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/tests/team-todo`,
      headers: viewerHeaders
    });
    expect(viewerRes.statusCode).toBe(200);

    const invalidAssigneeRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/tests/team-todo?assigneeId=999999999`,
      headers: ownerHeaders
    });
    expect(invalidAssigneeRes.statusCode).toBe(400);

    const milestoneRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/milestones`,
      headers: ownerHeaders,
      payload: { name: "Release 1", dueDate: "2026-12-31T00:00:00.000Z" }
    });
    const milestoneId = (milestoneRes.json() as { data: { id: string } }).data.id;

    const datedRunRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers: ownerHeaders,
      payload: {
        name: "Milestone run",
        includeAll: true,
        milestoneId,
        dueOn: "2020-01-01T00:00:00.000Z"
      }
    });
    const datedRunId = (datedRunRes.json() as { data: { id: string } }).data.id;

    const datedInstancesRes = await app.inject({
      method: "GET",
      url: `/api/runs/${datedRunId}?includeInstances=true`,
      headers: ownerHeaders
    });
    const datedTestId = (
      datedInstancesRes.json() as { data: { instances: Array<{ id: string }> } }
    ).data.instances[0]?.id;
    expect(datedTestId).toBeTruthy();

    await app.inject({
      method: "PATCH",
      url: `/api/tests/${datedTestId}/assignee`,
      headers: ownerHeaders,
      payload: { assignedTo: assigneeA }
    });

    const overdueRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/tests/team-todo?overdue=true`,
      headers: ownerHeaders
    });
    const overdueItems = (
      overdueRes.json() as { data: { items: Array<{ testId: string; agingLevel: string }> } }
    ).data.items;
    expect(overdueItems.some((row) => row.testId === datedTestId)).toBe(true);
    expect(overdueItems.find((row) => row.testId === datedTestId)?.agingLevel).toBe("overdue");

    const milestoneFilterRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/tests/assigned-to-me?milestoneId=${milestoneId}`,
      headers: await (async () => {
        const login = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: assigneeEmail, password: "password" }
        });
        return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
      })()
    });
    expect(milestoneFilterRes.statusCode).toBe(200);
    const milestoneItems = (milestoneFilterRes.json() as { data: { items: Array<{ testId: string }> } }).data
      .items;
    expect(milestoneItems.some((row) => row.testId === datedTestId)).toBe(true);
  });
});
