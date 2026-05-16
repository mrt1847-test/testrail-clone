import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { mapSections } from "../modules/testrail/testrail.mappers.js";
import { TESTRAIL_V2_SUPPORTED } from "../modules/testrail/testrail.supported.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("/api/v2 TestRail adapter contract", () => {
  it("exposes supported endpoint index", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { supported: string[] };
    expect(body.supported).toContain("GET get_suites/{project_id}");
    expect(body.supported).toContain("GET get_statuses");
    expect(body.supported).toContain("GET get_configs/{project_id}");
    expect(body.supported).toContain("GET get_case_fields/{project_id}");
    expect(body.supported).toContain("GET get_reports/{project_id}");
    expect(body.supported).toContain("GET get_roles");
    expect(body.supported).toContain("GET get_attachments_for_case/{case_id}");
    expect(body.supported).toContain("POST run_report/{report_id}");
  });

  it("documents supported routes in TESTRAIL_V2_SUPPORTED", () => {
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_sections/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_milestones/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_templates/{project_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_users");
    expect(TESTRAIL_V2_SUPPORTED).toContain("GET get_attachments_for_result/{result_id}");
    expect(TESTRAIL_V2_SUPPORTED).toContain("POST run_report/{report_id}");
  });

  it("exposes get_projects as a JSON array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/get_projects" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: number; name: string; is_completed: boolean }>;
    expect(Array.isArray(body)).toBe(true);
  });

  it("returns 404 for unknown case on get_case", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/get_case/999999999" });
    expect(res.statusCode).toBe(404);
  });

  it("returns get_statuses as a JSON array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/get_statuses" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ id: number; name: string; label: string }>;
    expect(body.length).toBeGreaterThanOrEqual(5);
    expect(body.some((row) => row.name === "passed")).toBe(true);
  });

  it("lists suites and sections for a created project", async () => {
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
      payload: { name: "V2 Project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/suites`,
      headers,
      payload: { name: "V2 Suite" }
    });
    const suite = suiteRes.json() as { data: { id: string } };

    await app.inject({
      method: "POST",
      url: `/api/suites/${suite.data.id}/sections`,
      headers,
      payload: { name: "V2 Section" }
    });

    const suitesRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_suites/${project.data.id}`
    });
    expect(suitesRes.statusCode).toBe(200);
    const suites = suitesRes.json() as Array<{ id: number; name: string; project_id: number }>;
    expect(suites.some((row) => row.id === Number(suite.data.id))).toBe(true);

    const sectionsRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_sections/${project.data.id}?suite_id=${suite.data.id}`
    });
    expect(sectionsRes.statusCode).toBe(200);
    const sections = sectionsRes.json() as Array<{ id: number; name: string; suite_id: number }>;
    expect(sections.length).toBeGreaterThanOrEqual(1);
    expect(sections[0]?.suite_id).toBe(Number(suite.data.id));

    const milestonesRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_milestones/${project.data.id}`
    });
    expect(milestonesRes.statusCode).toBe(200);
    expect(Array.isArray(milestonesRes.json())).toBe(true);

    const catalogEndpoints = [
      `/api/v2/get_configs/${project.data.id}`,
      `/api/v2/get_case_fields/${project.data.id}`,
      `/api/v2/get_result_fields/${project.data.id}`,
      `/api/v2/get_templates/${project.data.id}`,
      `/api/v2/get_users/${project.data.id}`,
      `/api/v2/get_reports/${project.data.id}`,
      "/api/v2/get_roles"
    ];
    for (const url of catalogEndpoints) {
      const catalogRes = await app.inject({ method: "GET", url });
      expect(catalogRes.statusCode).toBe(200);
      expect(Array.isArray(catalogRes.json())).toBe(true);
    }

    const usersRes = await app.inject({ method: "GET", url: "/api/v2/get_users" });
    expect(usersRes.statusCode).toBe(200);
    expect(Array.isArray(usersRes.json())).toBe(true);

    const attachmentsForCaseRes = await app.inject({
      method: "GET",
      url: "/api/v2/get_attachments_for_case/999999999"
    });
    expect(attachmentsForCaseRes.statusCode).toBe(200);
    expect(Array.isArray(attachmentsForCaseRes.json())).toBe(true);

    const attachmentsForResultRes = await app.inject({
      method: "GET",
      url: "/api/v2/get_attachments_for_result/999999999"
    });
    expect(attachmentsForResultRes.statusCode).toBe(200);
    expect(Array.isArray(attachmentsForResultRes.json())).toBe(true);

    const missingSuiteRes = await app.inject({
      method: "GET",
      url: `/api/v2/get_sections/${project.data.id}`
    });
    expect(missingSuiteRes.statusCode).toBe(400);
  });
});

describe("testrail section mapper", () => {
  it("computes nested depth", () => {
    const rows = mapSections([
      { id: 1n, suiteId: 10n, parentSectionId: null, name: "Root", displayOrder: 1 },
      { id: 2n, suiteId: 10n, parentSectionId: 1n, name: "Child", displayOrder: 2 }
    ]);
    expect(rows.find((row) => row.id === 1)?.depth).toBe(0);
    expect(rows.find((row) => row.id === 2)?.depth).toBe(1);
  });
});
