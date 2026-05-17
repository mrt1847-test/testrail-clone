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

describe("execution comments API", () => {
  it.skipIf(!integrationEnabled)("lists and creates test/run comments with permission gates", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const ownerHeaders = { authorization: `Bearer ${(loginRes.json() as { token: string }).token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: ownerHeaders,
      payload: { name: "Execution comments project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers: ownerHeaders,
      payload: { name: "Sprint run", includeAll: true }
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

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers: ownerHeaders,
      payload: { title: "Checkout" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/tests`,
      headers: ownerHeaders,
      payload: { caseIds: [caseId] }
    });

    const instancesRes = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}?includeInstances=true`,
      headers: ownerHeaders
    });
    const testId = (
      instancesRes.json() as { data: { instances: Array<{ id: string }> } }
    ).data.instances[0]?.id;
    expect(testId).toBeTruthy();

    const runCommentRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/execution-comments`,
      headers: ownerHeaders,
      payload: { content: "Run kickoff notes" }
    });
    expect(runCommentRes.statusCode).toBe(200);

    const testCommentRes = await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/execution-comments`,
      headers: ownerHeaders,
      payload: { content: "Blocked on env setup" }
    });
    expect(testCommentRes.statusCode).toBe(200);
    const testComment = testCommentRes.json() as { data: { id: string } };

    const replyRes = await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/execution-comments`,
      headers: ownerHeaders,
      payload: { content: "Following up tomorrow", parentId: testComment.data.id }
    });
    expect(replyRes.statusCode).toBe(200);

    const listTest = await app.inject({
      method: "GET",
      url: `/api/tests/${testId}/execution-comments`,
      headers: ownerHeaders
    });
    expect(listTest.statusCode).toBe(200);
    const testItems = (listTest.json() as { data: Array<{ content: string; parentId: string | null }> }).data;
    expect(testItems).toHaveLength(2);
    expect(testItems.some((row) => row.parentId != null)).toBe(true);

    const viewerEmail = `viewer-exec-${Date.now()}@example.com`;
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

    const viewerPost = await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/execution-comments`,
      headers: viewerHeaders,
      payload: { content: "Should be forbidden" }
    });
    expect(viewerPost.statusCode).toBe(403);

    const viewerList = await app.inject({
      method: "GET",
      url: `/api/tests/${testId}/execution-comments`,
      headers: viewerHeaders
    });
    expect(viewerList.statusCode).toBe(200);
  });
});
