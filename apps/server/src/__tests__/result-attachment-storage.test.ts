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

describe("result attachment storage contract", () => {
  it("rejects memory-mode presign instead of returning a fake result-not-found 404", async () => {
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
      payload: { name: "UI-031 storage contract" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Auth" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;
    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Login" }
    });

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
    const testId = (instancesRes.json() as { data: { instances: Array<{ id: string }> } }).data.instances[0]?.id;
    expect(testId).toBeTruthy();

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/results`,
      headers,
      payload: { status: "passed" }
    });
    const resultId = (resultRes.json() as { id: string }).id;

    const presignRes = await app.inject({
      method: "POST",
      url: `/api/results/${resultId}/attachments/presign`,
      headers,
      payload: { fileName: "bytes-proof.bin", contentType: "application/octet-stream" }
    });
    expect(presignRes.statusCode).toBe(501);
    expect(presignRes.json()).toMatchObject({
      error: { code: "STORAGE_UNAVAILABLE", message: "attachment storage is not available" }
    });
  });
});
