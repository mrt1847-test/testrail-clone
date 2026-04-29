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

  it("creates and updates project custom fields", async () => {
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
      payload: { name: "Custom field project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const createRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/settings/custom-fields`,
      headers: mutationHeaders,
      payload: {
        name: "Risk",
        fieldType: "select",
        options: ["High", "Medium", "Low"],
        isRequired: true
      }
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json() as { data: { id: string; systemName: string; options: string[] } };
    expect(created.data.systemName).toBe("risk");
    expect(created.data.options).toEqual(["High", "Medium", "Low"]);

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${project.data.id}/settings/custom-fields/${created.data.id}`,
      headers: mutationHeaders,
      payload: { name: "Product Risk", isActive: false }
    });
    expect(updateRes.statusCode).toBe(200);
    expect((updateRes.json() as { data: { name: string; isActive: boolean } }).data).toMatchObject({
      name: "Product Risk",
      isActive: false
    });

    const listRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/settings/custom-fields`
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as { data: Array<{ name: string }> };
    expect(list.data.some((field) => field.name === "Product Risk")).toBe(true);
  });

  it("creates and updates project custom statuses", async () => {
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
      payload: { name: "Custom status project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const defaultListRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/settings/statuses`
    });
    expect(defaultListRes.statusCode).toBe(200);
    const defaultList = defaultListRes.json() as { data: Array<{ systemName: string; isSystem: boolean }> };
    expect(defaultList.data.some((status) => status.systemName === "passed" && status.isSystem)).toBe(true);

    const createRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/settings/statuses`,
      headers: mutationHeaders,
      payload: {
        name: "Needs Investigation",
        canonicalStatus: "retest",
        color: "#0f766e",
        displayOrder: 50
      }
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json() as { data: { id: string; systemName: string; canonicalStatus: string } };
    expect(created.data).toMatchObject({
      systemName: "needs_investigation",
      canonicalStatus: "retest"
    });

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${project.data.id}/settings/statuses/${created.data.id}`,
      headers: mutationHeaders,
      payload: { canonicalStatus: "failed", isActive: false }
    });
    expect(updateRes.statusCode).toBe(200);
    expect((updateRes.json() as { data: { canonicalStatus: string; isActive: boolean } }).data).toMatchObject({
      canonicalStatus: "failed",
      isActive: false
    });
  });
});
