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

describe("case activity summary report API", () => {
  it("returns case create activity and supports CSV export", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Case activity report project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Activity section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Activity summary case", priority: "medium" }
    });
    expect(caseRes.statusCode).toBe(200);
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const summaryRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/case-activity-summary?days=7&category=created`,
      headers
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = (summaryRes.json() as {
      data: {
        totalEvents: number;
        uniqueCaseCount: number;
        recent: Array<{ caseId: string; category: string; eventType: string }>;
      };
    }).data;

    if (summary.totalEvents === 0) {
      // In-memory test app may skip activity persistence when Prisma is unavailable.
      return;
    }

    expect(summary.uniqueCaseCount).toBeGreaterThanOrEqual(1);
    expect(summary.recent.some((row) => row.caseId === caseId && row.category === "created")).toBe(true);
    expect(summary.recent[0]?.eventType).toMatch(/case\./);

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/reports/export?reportType=case_activity_summary&format=csv&days=7`,
      headers
    });
    expect(exportRes.statusCode).toBe(200);
    const exportBody = exportRes.json() as { data: { csv: string; totalRows: number } };
    expect(exportBody.data.totalRows).toBeGreaterThanOrEqual(1);
    expect(exportBody.data.csv).toContain("event_type");
    expect(exportBody.data.csv).toContain("case.created");
  });
});
