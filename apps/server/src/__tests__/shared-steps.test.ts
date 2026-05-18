import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
const describeIntegration = integrationEnabled ? describe : describe.skip;

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describeIntegration("shared steps API", () => {
  it("creates, lists, links, and exposes shared steps via v2", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const headers = { authorization: `Bearer ${token}` };

    const projectsRes = await app.inject({ method: "GET", url: "/api/projects", headers });
    const projects = projectsRes.json() as Array<{ id: number }>;
    const projectId = projects[0]?.id;
    expect(projectId).toBeDefined();

    const suitesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites`,
      headers
    });
    const suites = suitesRes.json() as Array<{ id: number }>;
    const suiteId = suites[0]?.id;
    expect(suiteId).toBeDefined();

    const sectionsRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites/${suiteId}/sections`,
      headers
    });
    const sections = sectionsRes.json() as { sections: Array<{ id: number }> };
    const sectionId = sections.sections[0]?.id;
    expect(sectionId).toBeDefined();

    const caseRes = await app.inject({
      method: "POST",
      url: "/api/cases",
      headers,
      payload: { sectionId, title: "Shared step link target" }
    });
    expect(caseRes.statusCode).toBe(200);
    const createdCase = caseRes.json() as { data: { id: number } };
    const caseId = createdCase.data.id;

    const createRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/shared-steps`,
      headers,
      payload: {
        title: "Login",
        entries: [
          { content: "Open app", expectedResult: "App loads" },
          { content: "Enter credentials", expectedResult: "Dashboard visible" }
        ]
      }
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json() as { data: { id: number } };
    const sharedStepId = created.data.id;

    const listRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/shared-steps`,
      headers
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as Array<{ id: number; title: string }>;
    expect(list.some((row) => row.id === sharedStepId && row.title === "Login")).toBe(true);

    const linkRes = await app.inject({
      method: "POST",
      url: `/api/cases/${caseId}/shared-steps/${sharedStepId}`,
      headers
    });
    expect(linkRes.statusCode).toBe(200);
    const linked = linkRes.json() as { data: Array<{ content: string }> };
    expect(linked.data).toHaveLength(2);

    const v2Res = await app.inject({
      method: "GET",
      url: `/api/v2/get_shared_steps/${projectId}`,
      headers
    });
    expect(v2Res.statusCode).toBe(200);
    const v2Rows = v2Res.json() as Array<{ id: number; title: string; case_ids: number[] }>;
    const row = v2Rows.find((item) => item.id === sharedStepId);
    expect(row?.title).toBe("Login");
    expect(row?.case_ids).toContain(caseId);
  });
});
