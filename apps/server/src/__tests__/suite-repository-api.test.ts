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

  it("keeps sibling sections out of a subtree query when sectionScope is explicit", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "UI-022 scope membership" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const authRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Authentication" }
    });
    const authId = (authRes.json() as { data: { id: string } }).data.id;
    const loginRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Login", parentSectionId: authId }
    });
    const loginId = (loginRes.json() as { data: { id: string } }).data.id;
    const billingRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Billing" }
    });
    const billingId = (billingRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "POST",
      url: `/api/sections/${authId}/cases`,
      headers,
      payload: { title: "Auth A" }
    });
    await app.inject({
      method: "POST",
      url: `/api/sections/${authId}/cases`,
      headers,
      payload: { title: "Auth B" }
    });
    await app.inject({
      method: "POST",
      url: `/api/sections/${loginId}/cases`,
      headers,
      payload: { title: "Login A" }
    });
    await app.inject({
      method: "POST",
      url: `/api/sections/${billingId}/cases`,
      headers,
      payload: { title: "Billing A" }
    });

    const direct = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites/${suiteId}/cases?sectionId=${authId}&sectionScope=direct&groupBy=section_id`,
      headers
    });
    expect((direct.json() as { data: { total: number } }).data.total).toBe(2);

    const subtree = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites/${suiteId}/cases?sectionId=${authId}&sectionScope=subtree&groupBy=section_id`,
      headers
    });
    const subtreeBody = (subtree.json() as { data: { total: number; cases: Array<{ title: string }> } }).data;
    expect(subtreeBody.total).toBe(3);
    expect(subtreeBody.cases.map((row) => row.title)).not.toContain("Billing A");

    const all = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites/${suiteId}/cases?sectionScope=subtree&groupBy=section_id`,
      headers
    });
    expect((all.json() as { data: { total: number } }).data.total).toBe(4);
  });
});
