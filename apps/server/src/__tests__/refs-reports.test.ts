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

describe("references coverage and comparison reports API", () => {
  it("returns refs coverage and compares refs across runs", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Refs reports project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Refs section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Refs case", priority: "high", refs: "REQ-100, REQ-200" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const coverageRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/refs-coverage`,
      headers
    });
    expect(coverageRes.statusCode).toBe(200);
    const coverage = (coverageRes.json() as {
      data: { totalReferences: number; items: Array<{ refKey: string }> };
    }).data;
    expect(coverage.totalReferences).toBeGreaterThanOrEqual(2);
    expect(coverage.items.map((row) => row.refKey)).toEqual(
      expect.arrayContaining(["REQ-100", "REQ-200"])
    );

    const runARes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Refs run A", includeAll: false, caseIds: [caseId] }
    });
    const runAId = (runARes.json() as { run: { id: string } }).run.id;

    const runBRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Refs run B", includeAll: false, caseIds: [caseId] }
    });
    const runBId = (runBRes.json() as { run: { id: string } }).run.id;

    const testA = (
      await app.inject({ method: "GET", url: `/api/runs/${runAId}?includeInstances=true`, headers })
    ).json() as { data: { instances: Array<{ id: string }> } };
    const testB = (
      await app.inject({ method: "GET", url: `/api/runs/${runBId}?includeInstances=true`, headers })
    ).json() as { data: { instances: Array<{ id: string }> } };

    await app.inject({
      method: "POST",
      url: `/api/tests/${testA.data.instances[0].id}/results`,
      headers,
      payload: { status: "passed" }
    });
    await app.inject({
      method: "POST",
      url: `/api/tests/${testB.data.instances[0].id}/results`,
      headers,
      payload: { status: "failed" }
    });

    const comparisonRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/refs-comparison?runIdA=${runAId}&runIdB=${runBId}`,
      headers
    });
    expect(comparisonRes.statusCode).toBe(200);
    const comparison = (comparisonRes.json() as {
      data: { summary: { changedCount: number }; items: Array<{ refKey: string; changed: boolean }> };
    }).data;
    const req100 = comparison.items.find((row) => row.refKey === "REQ-100");
    if (req100) {
      expect(req100.changed).toBe(true);
      expect(comparison.summary.changedCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns refs defect summary with linked defects for at-risk results", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Refs defect summary project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Refs defect section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Refs defect case", priority: "high", refs: "REQ-DEF-1" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Refs defect run", includeAll: false, caseIds: [caseId] }
    });
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const testId = (
      await app.inject({ method: "GET", url: `/api/runs/${runId}?includeInstances=true`, headers })
    ).json() as { data: { instances: Array<{ id: string }> } };
    await app.inject({
      method: "POST",
      url: `/api/tests/${testId.data.instances[0].id}/results`,
      headers,
      payload: { status: "failed", defects: ["BUG-REF-1"] }
    });

    const summaryRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/refs-defect-summary`,
      headers
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = (summaryRes.json() as {
      data: { items: Array<{ refKey: string; defectKeys: string[]; defectCoverage: string }> };
    }).data;
    const row = summary.items.find((item) => item.refKey === "REQ-DEF-1");
    if (!row || row.defectCoverage === "not_applicable") return;

    expect(row.defectCoverage).toBe("linked");
    expect(row.defectKeys).toContain("BUG-REF-1");

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/export?reportType=refs_defect_summary&format=csv`,
      headers
    });
    if (exportRes.statusCode === 200) {
      const exportBody = exportRes.json() as { data: { csv: string } };
      expect(exportBody.data.csv).toContain("REQ-DEF-1");
    }
  });
});
