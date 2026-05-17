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

    const caseRes2 = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Second print case", priority: "medium" }
    });
    const caseId2 = (caseRes2.json() as { data: { id: string } }).data.id;

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

    const multiPrintRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/cases/print`,
      headers,
      payload: { caseIds: [caseId, caseId2] }
    });
    expect(multiPrintRes.statusCode).toBe(200);
    const multiPrint = (multiPrintRes.json() as { data: { entityType: string; sections: unknown[] } }).data;
    expect(multiPrint.entityType).toBe("cases");
    expect(multiPrint.sections?.length).toBe(2);

    const multiHtmlRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/cases/print?caseIds=${caseId},${caseId2}&format=html`,
      headers
    });
    expect(multiHtmlRes.statusCode).toBe(200);
    expect(multiHtmlRes.body).toContain("Print case");
    expect(multiHtmlRes.body).toContain("Second print case");

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
    const runPrint = (runPrintRes.json() as { data: { entityType: string; tables: Array<{ title: string }> } })
      .data;
    expect(runPrint.entityType).toBe("run");
    expect(runPrint.tables.some((table) => table.title === "Status breakdown")).toBe(true);

    const milestoneRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/milestones`,
      headers,
      payload: { name: "Print milestone" }
    });
    const milestoneId = (milestoneRes.json() as { data: { id: string } }).data.id;

    const milestonePrintRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/milestones/${milestoneId}/print`,
      headers
    });
    expect(milestonePrintRes.statusCode).toBe(200);
    expect(
      (milestonePrintRes.json() as { data: { entityType: string; title: string } }).data.entityType
    ).toBe("milestone");

    const planRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plans`,
      headers,
      payload: { name: "Print plan" }
    });
    const planId = (planRes.json() as { data: { id: string } }).data.id;

    const planPrintRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/plans/${planId}/print`,
      headers
    });
    expect(planPrintRes.statusCode).toBe(200);
    const planPrint = (planPrintRes.json() as { data: { entityType: string; title: string } }).data;
    expect(planPrint.entityType).toBe("plan");
    expect(planPrint.title).toBe("Print plan");

    const reportPrintRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/print?reportType=project_summary`,
      headers
    });
    expect(reportPrintRes.statusCode).toBe(200);
    const reportPrint = (reportPrintRes.json() as { data: { entityType: string; title: string } }).data;
    expect(reportPrint.entityType).toBe("report");
    expect(reportPrint.title).toBe("Project summary");

    const reportHtmlRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/print?reportType=status_tops&format=html`,
      headers
    });
    expect(reportHtmlRes.statusCode).toBe(200);
    expect(reportHtmlRes.headers["content-type"]).toContain("text/html");
    expect(reportHtmlRes.body).toContain("Status tops");
  });
});
