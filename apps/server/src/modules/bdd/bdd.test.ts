import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";

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

describe("BDD scenarios API", () => {
  it("imports feature text and records scenario-level run results", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "BDD project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suitesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites`,
      headers
    });
    const suiteId = (suitesRes.json() as { data: Array<{ id: string }> }).data[0]!.id;

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "BDD section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const importRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/bdd/features/import`,
      headers,
      payload: {
        sectionId,
        featureText: `
Feature: Payments
  Scenario: Card payment
    Given a saved card
    When payment is submitted
    Then payment succeeds
`
      }
    });
    expect(importRes.statusCode).toBe(200);
    const imported = (importRes.json() as { data: { cases: Array<{ caseId: string }> } }).data;
    expect(imported.cases.length).toBeGreaterThan(0);
    const caseId = imported.cases[0]!.caseId;

    const scenariosRes = await app.inject({
      method: "GET",
      url: `/api/cases/${caseId}/scenarios`,
      headers
    });
    expect(scenariosRes.statusCode).toBe(200);
    const scenarios = (scenariosRes.json() as { data: Array<{ id: string }> }).data;
    expect(scenarios.length).toBe(1);

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "BDD run", includeAll: false, caseIds: [caseId] }
    });
    expect(runRes.statusCode).toBe(200);
    const runPayload = runRes.json() as { run: { id: string }; instances: Array<{ id: string }> };
    const runId = runPayload.run.id;
    const testId = runPayload.instances[0]!.id;

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/results`,
      headers,
      payload: {
        status: "passed",
        scenarioResults: [{ caseScenarioId: scenarios[0]!.id, status: "passed", comment: "ok" }]
      }
    });
    expect(resultRes.statusCode).toBe(200);
    const resultPayload = resultRes.json() as { data?: { id: string }; id?: string };
    const resultId = resultPayload.data?.id ?? resultPayload.id;
    expect(resultId).toBeTruthy();

    const scenarioResultsRes = await app.inject({
      method: "GET",
      url: `/api/results/${resultId}/scenarios`,
      headers
    });
    expect(scenarioResultsRes.statusCode).toBe(200);
    const scenarioResults = scenarioResultsRes.json() as Array<{ caseScenarioId: string; status: string }>;
    expect(scenarioResults.length).toBe(1);
    expect(scenarioResults[0]!.status).toBe("passed");

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/bdd/features/export?caseId=${caseId}`,
      headers
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.body).toContain("Feature: Payments");
  });
});
