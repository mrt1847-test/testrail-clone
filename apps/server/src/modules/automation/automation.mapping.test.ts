import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { resolveAutomationFailureGuidance } from "./automation.failureGuidance.js";

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

describe("resolveAutomationFailureGuidance", () => {
  it("maps run membership errors", () => {
    const row = resolveAutomationFailureGuidance("case 9 not found in run 3", "failed");
    expect(row?.errorCode).toBe("CASE_NOT_FOUND_IN_RUN");
    expect(row?.guidance).toContain("case_id");
  });
});

describe("automation mapping dashboard APIs", () => {
  it("returns mapping health and supports mapping updates in memory mode", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectsRes = await app.inject({ method: "GET", url: "/api/projects", headers });
    const projectId = (projectsRes.json() as { data: Array<{ id: string }> }).data[0]?.id;
    expect(projectId).toBeTruthy();

    const summaryRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/automation/summary`,
      headers
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = (summaryRes.json() as { data: Record<string, unknown> }).data;
    expect(summary).toHaveProperty("totalCases");
    expect(summary).toHaveProperty("coveragePercent");
    expect(summary).toHaveProperty("pendingRetryCount");

    const unmappedRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/automation/mappings?coverage=unmapped&pageSize=20`,
      headers
    });
    expect(unmappedRes.statusCode).toBe(200);
    const unmapped = (unmappedRes.json() as { data: Array<{ caseId: string }> }).data;
    if (unmapped.length === 0) return;

    const caseId = unmapped[0]!.caseId;
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/automation/mappings/${caseId}`,
      headers,
      payload: { automationKey: "AUTO-E2E-MAPPING" }
    });
    expect(patchRes.statusCode).toBe(200);
    expect((patchRes.json() as { data: { automationKey: string } }).data.automationKey).toBe("AUTO-E2E-MAPPING");

    const mappedRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/automation/mappings?coverage=mapped&q=AUTO-E2E-MAPPING`,
      headers
    });
    expect(mappedRes.statusCode).toBe(200);
    const mapped = (mappedRes.json() as { data: Array<{ caseId: string; automationKey: string }> }).data;
    expect(mapped.some((row) => row.caseId === caseId && row.automationKey === "AUTO-E2E-MAPPING")).toBe(true);

    const queueRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/automation/retry-queue`,
      headers
    });
    expect(queueRes.statusCode).toBe(200);
    expect(Array.isArray((queueRes.json() as { data: unknown[] }).data)).toBe(true);
  });
});
