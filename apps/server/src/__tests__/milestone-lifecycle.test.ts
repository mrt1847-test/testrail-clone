import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

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

describe("milestone lifecycle API (in-memory)", () => {
  it("supports upcoming/open/complete lifecycle, start-now, and parent/child links", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Milestone lifecycle project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const parentRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/milestones`,
      headers,
      payload: { name: "Release train" }
    });
    const parentId = (parentRes.json() as { data: { id: string } }).data.id;

    const upcomingRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/milestones`,
      headers,
      payload: {
        name: "Sprint gate",
        parentMilestoneId: parentId,
        startDate: "2030-01-01T00:00:00.000Z"
      }
    });
    expect(upcomingRes.statusCode).toBe(200);
    const upcoming = (upcomingRes.json() as {
      data: { id: string; lifecycleStatus: string; parentMilestoneId: string };
    }).data;
    const upcomingId = upcoming.id;
    expect(upcoming.lifecycleStatus).toBe("upcoming");
    expect(upcoming.parentMilestoneId).toBe(parentId);

    const startRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/milestones/${upcomingId}`,
      headers,
      payload: { startNow: true }
    });
    expect(startRes.statusCode).toBe(200);
    expect((startRes.json() as { data: { lifecycleStatus: string } }).data.lifecycleStatus).toBe("open");

    const completeRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/milestones/${upcomingId}`,
      headers,
      payload: { isCompleted: true }
    });
    expect(completeRes.statusCode).toBe(200);
    expect((completeRes.json() as { data: { lifecycleStatus: string; isCompleted: boolean } }).data).toMatchObject({
      lifecycleStatus: "completed",
      isCompleted: true
    });

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/milestones/${parentId}`,
      headers
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = (detailRes.json() as { data: { children: Array<{ id: string }> } }).data;
    expect(detail.children.some((row) => row.id === upcomingId)).toBe(true);

    const cycleRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/milestones/${parentId}`,
      headers,
      payload: { parentMilestoneId: upcomingId }
    });
    expect(cycleRes.statusCode).toBe(400);
  });
});
