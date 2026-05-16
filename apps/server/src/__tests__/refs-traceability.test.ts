import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("refs traceability", () => {
  it("updates case refs and lists refs-traceability rows", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Refs project" }
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

    const createRes = await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers,
      payload: { title: "Checkout", refs: "REQ-9, REQ-10" }
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json() as { data: { id: string; refs?: string | null } };
    expect(created.data.refs).toBe("REQ-9, REQ-10");

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/cases/${created.data.id}`,
      headers,
      payload: { refs: "REQ-11" }
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = patchRes.json() as { data: { refs?: string | null } };
    expect(patched.data.refs).toBe("REQ-11");

    const reportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/reports/refs-traceability`,
      headers
    });
    expect(reportRes.statusCode).toBe(200);
    const report = reportRes.json() as {
      data: { items: Array<{ refKey: string; caseId: string; latestStatus: string }> };
    };
    expect(report.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ refKey: "REQ-11", caseId: created.data.id, latestStatus: "untested" })
      ])
    );
  });
});
