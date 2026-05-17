import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { PROJECT_TYPE_LABELS, canCreateSuite } from "../domain/projectTypes.js";

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

describe("projectTypes domain", () => {
  it("blocks a second suite on single-repository projects", () => {
    const result = canCreateSuite("single_repo", [{ isMaster: true, isBaseline: false }], {});
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PROJECT_SUITE_LIMIT");
  });

  it("labels all three project types", () => {
    expect(PROJECT_TYPE_LABELS.multi_suite).toBe("Multiple test suites");
  });
});

describe("project types API (in-memory)", () => {
  it("creates project with type and enforces suite policy", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Single repo project", projectType: "single_repo" }
    });
    const project = (projectRes.json() as { data: { id: string; projectType: string } }).data;
    expect(project.projectType).toBe("single_repo");

    const suitesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.id}/suites`,
      headers
    });
    const suites = (suitesRes.json() as { data: Array<{ isMaster: boolean }> }).data;
    expect(suites).toHaveLength(1);
    expect(suites[0]?.isMaster).toBe(true);

    const blocked = await app.inject({
      method: "POST",
      url: `/api/projects/${project.id}/suites`,
      headers,
      payload: { name: "Extra suite" }
    });
    expect(blocked.statusCode).toBe(409);
  });

  it("creates baseline suite with copied sections and independent cases", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Baseline project", projectType: "single_repo_baselines" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suitesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites`,
      headers
    });
    const masterSuite = (suitesRes.json() as { data: Array<{ id: string; isMaster: boolean }> }).data.find(
      (suite) => suite.isMaster
    )!;
    const sectionsRes = await app.inject({
      method: "GET",
      url: `/api/suites/${masterSuite.id}/sections`,
      headers
    });
    const masterSection = (sectionsRes.json() as { data: Array<{ id: string; name: string }> }).data[0]!;
    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${masterSection.id}/cases`,
      headers,
      payload: {
        title: "Master checkout case",
        priority: "high",
        caseType: "regression",
        expectedResult: "Order is placed"
      }
    });
    expect(caseRes.statusCode).toBe(200);
    const masterCase = (caseRes.json() as { data: { id: string } }).data;
    await app.inject({
      method: "POST",
      url: `/api/cases/${masterCase.id}/steps`,
      headers,
      payload: { content: "Open checkout", expectedResult: "Checkout opens" }
    });
    await app.inject({
      method: "POST",
      url: `/api/cases/${masterCase.id}/scenarios`,
      headers,
      payload: { name: "Happy path", content: "Given a cart\nWhen checkout completes\nThen the order is placed" }
    });

    const baselineRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/suites/baselines`,
      headers,
      payload: { name: "Release 1.0 baseline" }
    });
    expect(baselineRes.statusCode).toBe(200);
    const baseline = (baselineRes.json() as { data: { id: string; isBaseline: boolean; parentSuiteId: string | null } }).data;
    expect(baseline.isBaseline).toBe(true);
    expect(baseline.parentSuiteId).not.toBeNull();

    const baselineSectionsRes = await app.inject({
      method: "GET",
      url: `/api/suites/${baseline.id}/sections`,
      headers
    });
    const baselineSection = (baselineSectionsRes.json() as { data: Array<{ id: string; name: string }> }).data.find(
      (section) => section.name === masterSection.name
    )!;
    const baselineCasesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/cases?sectionId=${baselineSection.id}&sectionScope=direct`,
      headers
    });
    const baselineCases = (baselineCasesRes.json() as {
      data: Array<{ id: string; title: string; expectedResult?: string | null; steps?: unknown[] }>;
    }).data;
    expect(baselineCases).toHaveLength(1);
    expect(baselineCases[0]?.title).toBe("Master checkout case");
    expect(baselineCases[0]?.expectedResult).toBe("Order is placed");

    const baselineCaseDetailRes = await app.inject({
      method: "GET",
      url: `/api/cases/${baselineCases[0]!.id}`,
      headers
    });
    const baselineCaseDetail = (baselineCaseDetailRes.json() as {
      data: { steps: unknown[]; scenarios: unknown[] };
    }).data;
    expect(baselineCaseDetail.steps).toHaveLength(1);
    expect(baselineCaseDetail.scenarios).toHaveLength(1);

    await app.inject({
      method: "PATCH",
      url: `/api/cases/${baselineCases[0]!.id}`,
      headers,
      payload: { title: "Baseline checkout case" }
    });
    const masterCaseRes = await app.inject({
      method: "GET",
      url: `/api/cases/${masterCase.id}`,
      headers
    });
    expect((masterCaseRes.json() as { data: { title: string } }).data.title).toBe("Master checkout case");
  });
});
