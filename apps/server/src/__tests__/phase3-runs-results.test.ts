import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("phase3 runs/results flow", () => {
  it("supports run update, result post, and close workflow", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Phase3 Project" }
    });
    expect(projectRes.statusCode).toBe(200);
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/suites`,
      headers,
      payload: { name: "Phase3 Suite" }
    });
    expect(suiteRes.statusCode).toBe(200);
    const suiteId = (suiteRes.json() as { data: { id: string } }).data.id;

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Phase3 Section" }
    });
    expect(sectionRes.statusCode).toBe(200);
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Phase3 case", priority: "high" }
    });
    expect(caseRes.statusCode).toBe(200);
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      payload: {
        suiteId,
        name: "Initial run name",
        includeAll: false,
        caseIds: [caseId]
      }
    });
    expect(runRes.statusCode).toBe(200);
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/runs/${runId}`,
      payload: { name: "Updated run name" }
    });
    expect(patchRes.statusCode).toBe(200);
    expect((patchRes.json() as { data: { name: string } }).data.name).toBe("Updated run name");

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/runs/${runId}`
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json() as { data: { run: { id: string; status: string }; instances: Array<{ id: string }> } };
    expect(detail.data.instances.length).toBe(1);
    const testId = detail.data.instances[0].id;

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/results`,
      payload: {
        testId,
        status: "passed",
        comment: "ok",
        stepResults: [{ stepOrder: 1, status: "passed", actualResult: "step ok" }]
      }
    });
    expect(resultRes.statusCode).toBe(200);
    const resultId = (resultRes.json() as { id: string }).id;

    const historyRes = await app.inject({
      method: "GET",
      url: `/api/tests/${testId}/results`
    });
    expect(historyRes.statusCode).toBe(200);
    const history = historyRes.json() as Array<{ testInstanceId: string; status: string }>;
    expect(history.length).toBe(1);
    expect(history[0].testInstanceId).toBe(testId);
    expect(history[0].status).toBe("passed");

    const stepsRes = await app.inject({
      method: "GET",
      url: `/api/results/${resultId}/steps`
    });
    expect(stepsRes.statusCode).toBe(200);
    const steps = stepsRes.json() as Array<{ stepOrder: number; status: string }>;
    expect(steps.length).toBe(1);
    expect(steps[0].stepOrder).toBe(1);
    expect(steps[0].status).toBe("passed");

    const summaryRes = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}/summary`
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json() as { counts: Record<string, number> };
    expect(summary.counts.passed).toBe(1);

    const closeRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/close`
    });
    expect(closeRes.statusCode).toBe(200);
    expect((closeRes.json() as { data: { status: string } }).data.status).toBe("closed");
  });

  it("supports auth login -> me -> logout", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    expect(loginRes.statusCode).toBe(200);
    const { token } = loginRes.json() as { token: string };
    expect(token).toBeTruthy();

    const meRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(meRes.statusCode).toBe(200);

    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(logoutRes.statusCode).toBe(204);
  });

  it("protects last owner from removal", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Owner Protection Project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const membersRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/settings/members`,
      headers
    });
    expect(membersRes.statusCode).toBe(200);
    const members = (membersRes.json() as { data: Array<{ id: string; role: string }> }).data;
    if (members.length === 0) {
      const deleteInMemoryRes = await app.inject({
        method: "DELETE",
        url: `/api/projects/${projectId}/settings/members/1`,
        headers
      });
      expect(deleteInMemoryRes.statusCode).toBe(501);
      return;
    }
    expect(members.length).toBe(1);
    expect(members[0].role).toBe("owner");

    const removeRes = await app.inject({
      method: "DELETE",
      url: `/api/projects/${projectId}/settings/members/${members[0].id}`,
      headers
    });
    expect(removeRes.statusCode).toBe(409);
  });
});
