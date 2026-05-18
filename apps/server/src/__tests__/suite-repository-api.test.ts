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

describe("suite repository API", () => {
  async function login() {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    return (loginRes.json() as { token: string }).token;
  }

  it("returns suite summary counts", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Suite summary project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Repo section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Repo case", estimate: "15m" }
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites/${suiteId}/summary`,
      headers
    });
    expect(res.statusCode).toBe(200);
    const body = (
      res.json() as {
        data: {
          sectionCount: number;
          activeCaseCount: number;
          totalEstimateSeconds: number;
          totalEstimateDisplay: string | null;
        };
      }
    ).data;
    expect(body.sectionCount).toBeGreaterThanOrEqual(1);
    expect(body.activeCaseCount).toBeGreaterThanOrEqual(1);
    expect(body.totalEstimateSeconds).toBeGreaterThanOrEqual(900);
    expect(body.totalEstimateDisplay).toBe("15m");
  });

  it("returns grouped suite cases for a section subtree", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Suite grouped cases project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Grouped section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Grouped case" }
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites/${suiteId}/cases?sectionId=${sectionId}&display=subtree&groupBy=section_id`,
      headers
    });
    expect(res.statusCode).toBe(200);
    const body = (res.json() as { data: { groupBy: string; total: number; groups: Array<{ cases: unknown[] }> } })
      .data;
    expect(body.groupBy).toBe("section_id");
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.groups.length).toBeGreaterThanOrEqual(1);
    expect(body.groups[0]!.cases.length).toBeGreaterThanOrEqual(1);
  });

  it("returns grouped cases for an entire suite when sectionId is omitted", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Suite-wide cases project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Suite-wide section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Suite-wide case" }
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites/${suiteId}/cases?display=subtree&groupBy=section_id`,
      headers
    });
    expect(res.statusCode).toBe(200);
    const body = (res.json() as { data: { total: number } }).data;
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it("returns priority-grouped suite cases when groupBy=priority", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Priority grouped project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Priority section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "High case", priority: "high" }
    });
    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Low case", priority: "low" }
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites/${suiteId}/cases?display=subtree&groupBy=priority`,
      headers
    });
    expect(res.statusCode).toBe(200);
    const body = (res.json() as {
      data: { groupBy: string; groups: Array<{ groupLabel: string; groupKey: string }> };
    }).data;
    expect(body.groupBy).toBe("priority");
    expect(body.groups.length).toBeGreaterThanOrEqual(2);
    expect(body.groups[0]!.groupKey).toContain("priority-");
  });
});
