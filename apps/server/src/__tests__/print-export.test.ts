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

describe("print export API", () => {
  it("returns json and html print documents for case and run", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Print export project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Print section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: {
        title: "Print case",
        priority: "high",
        steps: [{ stepOrder: 1, content: "Do thing", expectedResult: "Done" }]
      }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const casePrintRes = await app.inject({
      method: "GET",
      url: `/api/cases/${caseId}/print`,
      headers
    });
    expect(casePrintRes.statusCode).toBe(200);
    const casePrint = (casePrintRes.json() as { data: { entityType: string; title: string } }).data;
    expect(casePrint.entityType).toBe("case");
    expect(casePrint.title).toBe("Print case");

    const caseHtmlRes = await app.inject({
      method: "GET",
      url: `/api/cases/${caseId}/print?format=html`,
      headers
    });
    expect(caseHtmlRes.statusCode).toBe(200);
    expect(caseHtmlRes.headers["content-type"]).toContain("text/html");
    expect(caseHtmlRes.body).toContain("Print case");

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Print run", includeAll: false, caseIds: [caseId] }
    });
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const runPrintRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/runs/${runId}/print`,
      headers
    });
    expect(runPrintRes.statusCode).toBe(200);
    const runPrint = (runPrintRes.json() as { data: { entityType: string } }).data;
    expect(runPrint.entityType).toBe("run");
  });
});
