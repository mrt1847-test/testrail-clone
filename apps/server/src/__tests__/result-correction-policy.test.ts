import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import { RESULT_CORRECTION_POLICY } from "../domain/resultCorrectionPolicy.js";
import { getMasterSuiteId } from "./testProjectSuites.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("result correction policy API", () => {
  it("exposes append-only policy document", () => {
    expect(RESULT_CORRECTION_POLICY.correctionMethod).toBe("add_result");
    expect(RESULT_CORRECTION_POLICY.allowEditHistoricalResult).toBe(false);
  });

  it.skipIf(!integrationEnabled)("rejects in-place result mutations and serves policy", async () => {
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
      payload: { name: "Result policy project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const policyRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/result-correction-policy`,
      headers
    });
    expect(policyRes.statusCode).toBe(200);
    expect((policyRes.json() as { data: { mode: string } }).data.mode).toBe("append_only");

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { name: "Policy run", includeAll: true }
    });
    const runId = (runRes.json() as { data: { id: string } }).data.id;

    const suiteId = await getMasterSuiteId(app, projectId, headers);
    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "SEC" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Policy case" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/tests`,
      headers,
      payload: { caseIds: [caseId] }
    });

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
      payload: { status: "passed", comment: "first" }
    });
    expect(resultRes.statusCode).toBe(200);
    const resultId = (resultRes.json() as { id: string }).id;

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/results/${resultId}`,
      headers,
      payload: { status: "failed" }
    });
    expect(patchRes.statusCode).toBe(405);
    expect(patchRes.json()).toMatchObject({
      error: { code: "RESULT_IMMUTABLE" }
    });

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/results/${resultId}`,
      headers
    });
    expect(deleteRes.statusCode).toBe(405);
  });
});
