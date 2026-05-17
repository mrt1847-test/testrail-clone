import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
const app = buildApp();

async function login() {
  const loginRes = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@example.com", password: "password" }
  });
  const { token } = loginRes.json() as { token: string };
  return { authorization: `Bearer ${token}` };
}

async function createProjectCase(headers: Record<string, string>, name: string) {
  const projectRes = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers,
    payload: { name }
  });
  const project = projectRes.json() as { data: { id: string } };

  const suiteRes = await app.inject({
    method: "POST",
    url: `/api/projects/${project.data.id}/suites`,
    headers,
    payload: { name: "Suite" }
  });
  const suite = suiteRes.json() as { data: { id: string } };

  const sectionRes = await app.inject({
    method: "POST",
    url: `/api/suites/${suite.data.id}/sections`,
    headers,
    payload: { name: "Section" }
  });
  const section = sectionRes.json() as { data: { id: string } };

  const caseRes = await app.inject({
    method: "POST",
    url: `/api/sections/${section.data.id}/cases`,
    headers,
    payload: {
      title: "Compatibility export case",
      preconditions: "Account exists",
      priority: "High",
      caseType: "Functional",
      refs: "REQ-TR-1, REQ-TR-2"
    }
  });
  const testCase = caseRes.json() as { data: { id: string } };

  return { projectId: project.data.id, suiteId: suite.data.id, caseId: testCase.data.id };
}

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe.skipIf(!integrationEnabled)("TestRail-shaped export payloads", () => {
  it("exports cases as a TestRail-compatible collection without changing clone JSON export", async () => {
    const headers = await login();
    const { projectId } = await createProjectCase(headers, "TestRail case export");

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/cases/export/testrail`,
      headers
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers["content-type"]).toContain("application/json");

    const body = exportRes.json() as {
      offset: number;
      limit: number;
      size: number;
      _links: { next: string | null; prev: string | null };
      cases: Array<{
        id: number;
        section_id: number;
        title: string;
        custom_preconds: string | null;
        refs: string | null;
        priority: string | null;
        type: string | null;
        custom_steps_separated: Array<{ content: string; expected: string }>;
      }>;
    };
    expect(body.offset).toBe(0);
    expect(body.limit).toBe(body.size);
    expect(body._links.next).toBeNull();
    expect(body.cases).toHaveLength(1);
    expect(body.cases[0]).toMatchObject({
      title: "Compatibility export case",
      custom_preconds: "Account exists",
      refs: "REQ-TR-1, REQ-TR-2",
      priority: "High",
      type: "Functional"
    });
    expect(Array.isArray(body.cases[0]?.custom_steps_separated)).toBe(true);

    const cloneJsonRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/cases/export/json`,
      headers
    });
    const cloneJson = cloneJsonRes.json() as { format: string; cases: unknown[] };
    expect(cloneJson.format).toBe("testrail-clone.cases");
  });

  it("exports run results with TestRail status ids and created_on timestamps", async () => {
    const headers = await login();
    const { projectId, suiteId, caseId } = await createProjectCase(headers, "TestRail result export");

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { name: "Run", suiteId, includeAll: true }
    });
    expect(runRes.statusCode).toBe(200);
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/results`,
      headers,
      payload: {
        caseId,
        status: "failed",
        comment: "Observed failure",
        elapsed: "1m",
        version: "1.0",
        source: "api",
        defects: ["BUG-1", "BUG-2"]
      }
    });
    expect(resultRes.statusCode).toBe(200);

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/runs/${runId}/results/export/testrail`,
      headers
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers["content-type"]).toContain("application/json");

    const body = exportRes.json() as {
      run_id: number;
      size: number;
      results: Array<{
        id: number;
        test_id: number;
        case_id: number;
        status_id: number;
        status: string;
        comment: string | null;
        elapsed: string | null;
        version: string | null;
        defects: string | null;
        created_on: number;
      }>;
    };
    expect(body.run_id).toBe(Number(runId));
    expect(body.size).toBe(1);
    expect(body.results[0]).toMatchObject({
      case_id: Number(caseId),
      status_id: 5,
      status: "failed",
      comment: "Observed failure",
      elapsed: "1m",
      version: "1.0",
      defects: "BUG-1, BUG-2"
    });
    expect(body.results[0]?.created_on).toBeGreaterThan(0);
  });
});
