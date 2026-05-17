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

describe("attachment storage hardening", () => {
  it.skipIf(!integrationEnabled)("rejects cross-project storage paths on result attachment register", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const headers = { authorization: `Bearer ${(loginRes.json() as { token: string }).token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Attachment boundary project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Run", includeAll: true }
    });
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
      payload: { status: "passed" }
    });
    const resultId = (resultRes.json() as { id: string }).id;

    const forbiddenRes = await app.inject({
      method: "POST",
      url: "/api/attachments",
      headers,
      payload: {
        resultId,
        fileName: "evil.bin",
        storagePath: "projects/999999/results/1/evil.bin"
      }
    });
    expect(forbiddenRes.statusCode).toBe(403);

    const presignRes = await app.inject({
      method: "POST",
      url: `/api/results/${resultId}/attachments/presign`,
      headers,
      payload: { fileName: "proof.txt", contentType: "text/plain" }
    });
    expect(presignRes.statusCode).toBe(200);
    const presign = presignRes.json() as { data: { storagePath: string } };
    expect(presign.data.storagePath).toContain(`projects/${projectId}/results/${resultId}/`);

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/attachments",
      headers,
      payload: {
        resultId,
        fileName: "proof.txt",
        storagePath: presign.data.storagePath
      }
    });
    expect(registerRes.statusCode).toBe(200);
    const attachmentId = (registerRes.json() as { data: { id: string } }).data.id;

    const viewerEmail = `viewer-attach-${Date.now()}@example.com`;
    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/settings/members`,
      headers,
      payload: { email: viewerEmail, role: "viewer" }
    });
    const viewerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: viewerEmail, password: "password" }
    });
    const viewerHeaders = { authorization: `Bearer ${(viewerLogin.json() as { token: string }).token}` };

    const listDenied = await app.inject({
      method: "GET",
      url: `/api/results/${resultId}/attachments`,
      headers: viewerHeaders
    });
    expect(listDenied.statusCode).toBe(403);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/attachments/${attachmentId}`,
      headers
    });
    expect(deleteRes.statusCode).toBe(204);

    const row = await app.inject({
      method: "GET",
      url: `/api/attachments/${attachmentId}`,
      headers
    });
    expect(row.statusCode).toBe(404);

    const downloadDenied = await app.inject({
      method: "POST",
      url: `/api/attachments/${attachmentId}/download-url`,
      headers
    });
    expect(downloadDenied.statusCode).toBe(404);
  });
});
