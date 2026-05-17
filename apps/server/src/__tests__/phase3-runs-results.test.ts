import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getMasterSuiteId } from "./testProjectSuites.js";

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
    const meRes = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` }
    });
    const meUserId = (meRes.json() as { user: { id: string } }).user.id;
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Phase3 Project" }
    });
    expect(projectRes.statusCode).toBe(200);
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suiteId = await getMasterSuiteId(app, projectId, headers);

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
      payload: { title: "Phase3 case", priority: "high", estimate: "5m" }
    });
    expect(caseRes.statusCode).toBe(200);
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
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
      headers,
      payload: { name: "Updated run name" }
    });
    expect(patchRes.statusCode).toBe(200);
    expect((patchRes.json() as { data: { name: string } }).data.name).toBe("Updated run name");

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/runs/${runId}?includeInstances=false`
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json() as {
      data: {
        run: { id: string; status: string; progress?: number };
        metrics?: {
          total: number;
          executed: number;
          progressPercent: number;
          counts: { passed: number; untested: number };
        };
        instances: Array<{ id: string; titleSnapshot: string; status: string; automationKeySnapshot?: string | null }>;
      };
    };
    expect(detail.data.metrics?.total).toBe(1);
    expect(detail.data.metrics?.counts.untested).toBe(1);
    expect(detail.data.run.progress).toBe(0);
    expect(detail.data.instances).toEqual([]);

    const instancesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/runs/${runId}/instances?page=1&pageSize=20`
    });
    expect(instancesRes.statusCode).toBe(200);
    const instanceRows = (instancesRes.json() as { data: Array<{ id: string; titleSnapshot: string; status: string }> })
      .data;
    expect(instanceRows.length).toBe(1);
    expect(instanceRows[0].titleSnapshot).toBe("Phase3 case");
    expect(instanceRows[0].status).toBe("untested");
    const testId = instanceRows[0].id;

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/results`,
      headers,
      payload: {
        testId,
        status: "passed",
        comment: "ok",
        elapsed: "7m",
        stepResults: [{ stepOrder: 1, status: "passed", actualResult: "step ok" }]
      }
    });
    expect(resultRes.statusCode).toBe(200);
    const resultId = (resultRes.json() as { id: string }).id;

    const historyRes = await app.inject({
      method: "GET",
      url: `/api/tests/${testId}/results?page=1&pageSize=20`
    });
    expect(historyRes.statusCode).toBe(200);
    const historyPayload = historyRes.json() as {
      data: { items: Array<{ testInstanceId: string; status: string }> };
    };
    expect(historyPayload.data.items.length).toBe(1);
    expect(historyPayload.data.items[0].testInstanceId).toBe(testId);
    expect(historyPayload.data.items[0].status).toBe("passed");

    const assignTestRes = await app.inject({
      method: "PATCH",
      url: `/api/tests/${testId}/assignee`,
      headers,
      payload: { assignedTo: meUserId }
    });
    expect(assignTestRes.statusCode).toBe(200);

    const assignedToMeRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/tests/assigned-to-me`,
      headers
    });
    expect(assignedToMeRes.statusCode).toBe(200);
    const assignedPayload = assignedToMeRes.json() as { data: { items: Array<{ testId: string }> } };
    expect(assignedPayload.data.items.some((item) => item.testId === testId)).toBe(true);

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
    const summary = summaryRes.json() as {
      counts: Record<string, number>;
      progressPercent: number;
      executed: number;
    };
    expect(summary.counts.passed).toBe(1);
    expect(summary.progressPercent).toBe(100);
    expect(summary.executed).toBe(1);

    const overviewBeforeCloseRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/overview`
    });
    expect(overviewBeforeCloseRes.statusCode).toBe(200);
    const overviewBeforeClose = overviewBeforeCloseRes.json() as {
      data: { totalCases: number; activeRuns: number; recentFailures: number; automationCoveragePct: number };
    };
    expect(overviewBeforeClose.data.totalCases).toBeGreaterThanOrEqual(0);
    expect(overviewBeforeClose.data.activeRuns).toBe(1);

    const runSummaryRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/run-summary`
    });
    expect(runSummaryRes.statusCode).toBe(200);
    const runSummaryPayload = runSummaryRes.json() as {
      data: {
        items: Array<{
          runId: string;
          passed: number;
          progress: number;
          estimatedSeconds: number;
          actualSeconds: number;
          actualOverEstimateSeconds: number;
          estimate: string;
          actual: string;
          actualVsEstimate: string;
        }>;
      };
    };
    const matchedRun = runSummaryPayload.data.items.find((item) => item.runId === runId);
    expect(matchedRun?.passed).toBe(1);
    expect((matchedRun?.progress ?? 0) > 0).toBe(true);
    expect(matchedRun?.estimatedSeconds).toBe(300);
    expect(matchedRun?.actualSeconds).toBe(420);
    expect(matchedRun?.actualOverEstimateSeconds).toBe(120);
    expect(matchedRun?.estimate).toBe("5m");
    expect(matchedRun?.actual).toBe("7m");
    expect(matchedRun?.actualVsEstimate).toBe("+2m");

    const closeRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/close`,
      headers
    });
    expect(closeRes.statusCode).toBe(200);
    expect((closeRes.json() as { data: { status: string } }).data.status).toBe("closed");

    const overviewAfterCloseRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/overview`
    });
    expect(overviewAfterCloseRes.statusCode).toBe(200);
    const overviewAfterClose = overviewAfterCloseRes.json() as {
      data: { activeRuns: number };
    };
    expect(overviewAfterClose.data.activeRuns).toBe(0);
  });

  it("supports include-all run creation with suite snapshots", async () => {
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
      payload: { name: "Phase3 IncludeAll Project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "IncludeAll Section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "IA case 1", priority: "medium", caseType: "functional" }
    });
    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "IA case 2", priority: "high", caseType: "regression" }
    });

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Include all run", includeAll: true }
    });
    expect(runRes.statusCode).toBe(200);
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/runs/${runId}`
    });
    expect(detailRes.statusCode).toBe(200);
    const payload = detailRes.json() as {
      data: {
        instances: Array<{ titleSnapshot: string; status: string }>;
      };
    };
    expect(payload.data.instances.length).toBe(2);
    expect(payload.data.instances.every((row) => row.status === "untested")).toBe(true);
    expect(payload.data.instances.map((row) => row.titleSnapshot)).toEqual(
      expect.arrayContaining(["IA case 1", "IA case 2"])
    );
  });

  it("excludes archived cases from include-all run creation", async () => {
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
      payload: { name: "Archive Exclusion Project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Archive Exclusion Section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const firstCaseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Visible active case", priority: "medium", caseType: "functional" }
    });
    const firstCaseId = (firstCaseRes.json() as { data: { id: string } }).data.id;

    const secondCaseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Archived suite case", priority: "high", caseType: "regression" }
    });
    const secondCaseId = (secondCaseRes.json() as { data: { id: string } }).data.id;

    const archiveRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/cases/bulk-archive`,
      headers,
      payload: { caseIds: [secondCaseId], archived: true }
    });
    expect(archiveRes.statusCode).toBe(200);

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Archive exclusion run", includeAll: true }
    });
    expect(runRes.statusCode).toBe(200);
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/runs/${runId}`
    });
    expect(detailRes.statusCode).toBe(200);
    const payload = detailRes.json() as {
      data: {
        instances: Array<{ caseId: string; titleSnapshot: string }>;
      };
    };
    expect(payload.data.instances).toHaveLength(1);
    expect(payload.data.instances[0].caseId).toBe(firstCaseId);
    expect(payload.data.instances[0].caseId).not.toBe(secondCaseId);
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

  it("supports token compatibility routes", async () => {
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
      payload: { name: "Token Compat Project" }
    });
    expect(projectRes.statusCode).toBe(200);
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const createRes = await app.inject({
      method: "POST",
      url: "/api/tokens",
      headers,
      payload: { projectId, name: "compat token", scopes: ["automation:read", "automation:write"], expiresInDays: 30 }
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json() as { data: { id: string; projectId: string; name: string }; rawToken: string };
    expect(created.data.projectId).toBe(projectId);
    expect(created.data.name).toBe("compat token");
    expect(created.rawToken).toContain("tok_");

    const listRes = await app.inject({
      method: "GET",
      url: `/api/tokens?projectId=${projectId}`,
      headers
    });
    expect(listRes.statusCode).toBe(200);
    const listPayload = listRes.json() as { data: Array<{ id: string; projectId: string }> };
    expect(listPayload.data.some((item) => item.id === created.data.id)).toBe(true);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/tokens/${created.data.id}?projectId=${projectId}`,
      headers
    });
    expect(deleteRes.statusCode).toBe(204);
  });
});
