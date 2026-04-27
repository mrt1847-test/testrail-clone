import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("phase2 CRUD flow", () => {
  it("creates project/suite/section/case and lists by filters", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const mutationHeaders = { authorization: `Bearer ${token}` };
    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: mutationHeaders,
      payload: { name: "P1" }
    });
    expect(projectRes.statusCode).toBe(200);
    const project = projectRes.json() as { data: { id: string } };

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/suites`,
      headers: mutationHeaders,
      payload: { name: "S1" }
    });
    expect(suiteRes.statusCode).toBe(200);
    const suite = suiteRes.json() as { data: { id: string } };

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suite.data.id}/sections`,
      headers: mutationHeaders,
      payload: { name: "SEC1" }
    });
    expect(sectionRes.statusCode).toBe(200);
    const section = sectionRes.json() as { data: { id: string } };

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers: mutationHeaders,
      payload: { title: "Login case", priority: "high" }
    });
    expect(caseRes.statusCode).toBe(200);

    const listByProject = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/cases`
    });
    expect(listByProject.statusCode).toBe(200);
    const arr = listByProject.json() as { data: Array<{ title: string }> };
    expect(arr.data.some((c) => c.title === "Login case")).toBe(true);

    const listBySection = await app.inject({
      method: "GET",
      url: `/api/sections/${section.data.id}/cases`
    });
    expect(listBySection.statusCode).toBe(200);
    const arr2 = listBySection.json() as { data: Array<{ title: string }> };
    expect(arr2.data.length).toBeGreaterThan(0);
  });
});
