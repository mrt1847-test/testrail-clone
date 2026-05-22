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

describe("notification inbox filters and snooze", () => {
  it("lists notifications with type filter and snooze endpoint", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Inbox filter project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Inbox run", includeAll: true }
    });
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    await app.inject({
      method: "PATCH",
      url: `/api/runs/${runId}/assignee`,
      headers,
      payload: { assignedTo: "1" }
    });

    const listRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/notifications?type=assignment`,
      headers
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as { data: Array<{ id: string; type: string }> };
    if (listBody.data.length === 0) return;

    const notificationId = listBody.data[0]!.id;
    const snoozeRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/notifications/${notificationId}/snooze`,
      headers,
      payload: { snoozeHours: 24 }
    });
    expect(snoozeRes.statusCode).toBe(200);

    const hiddenRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/notifications`,
      headers
    });
    expect(hiddenRes.statusCode).toBe(200);
    const hidden = (hiddenRes.json() as { data: Array<{ id: string }> }).data;
    expect(hidden.some((row) => row.id === notificationId)).toBe(false);

    const readAllRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/notifications/read-all`,
      headers
    });
    expect(readAllRes.statusCode).toBe(200);
  });
});
