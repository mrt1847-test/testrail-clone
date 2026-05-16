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

    const riskFieldRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/settings/custom-fields`,
      headers: mutationHeaders,
      payload: {
        name: "Risk",
        fieldType: "select",
        options: ["High", "Medium", "Low"]
      }
    });
    expect(riskFieldRes.statusCode).toBe(200);

    const automationCandidateFieldRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/settings/custom-fields`,
      headers: mutationHeaders,
      payload: {
        name: "Automation Candidate",
        fieldType: "boolean"
      }
    });
    expect(automationCandidateFieldRes.statusCode).toBe(200);

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
      payload: { title: "Login case", priority: "high", customValues: { risk: "High" } }
    });
    expect(caseRes.statusCode).toBe(200);
    const createdCase = caseRes.json() as { data: { id: string; customValues: Record<string, unknown> } };
    expect(createdCase.data.customValues).toMatchObject({ risk: "High" });

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

    const updateCaseRes = await app.inject({
      method: "PATCH",
      url: `/api/cases/${createdCase.data.id}`,
      headers: mutationHeaders,
      payload: {
        title: "Login case updated",
        customValues: { risk: "Medium", automation_candidate: true },
        expectedVersion: 1
      }
    });
    expect(updateCaseRes.statusCode).toBe(200);
    expect((updateCaseRes.json() as { data: { customValues: Record<string, unknown> } }).data.customValues).toMatchObject({
      risk: "Medium",
      automation_candidate: true
    });
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

  it("rejects case creation when required custom fields are missing", async () => {
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
      payload: { name: "Required case field project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const fieldRes = await app.inject({
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
    expect(fieldRes.statusCode).toBe(200);

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/suites`,
      headers: mutationHeaders,
      payload: { name: "Required field suite" }
    });
    const suite = suiteRes.json() as { data: { id: string } };

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suite.data.id}/sections`,
      headers: mutationHeaders,
      payload: { name: "Required field section" }
    });
    const section = sectionRes.json() as { data: { id: string } };

    const missingFieldRes = await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers: mutationHeaders,
      payload: { title: "Missing risk" }
    });
    expect(missingFieldRes.statusCode).toBe(400);
    expect(missingFieldRes.json()).toMatchObject({
      code: "REQUIRED_CUSTOM_FIELD",
      field: "risk"
    });

    const validCaseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers: mutationHeaders,
      payload: { title: "Has risk", customValues: { risk: "High" } }
    });
    expect(validCaseRes.statusCode).toBe(200);
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

    const executionStatusesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/statuses`
    });
    expect(executionStatusesRes.statusCode).toBe(200);
    const executionStatuses = (executionStatusesRes.json() as { data: Array<{ name: string; isFinal?: boolean }> }).data;
    expect(executionStatuses.some((status) => status.name === "Needs Investigation")).toBe(true);

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

  it("rejects untested result after an existing result", async () => {
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
      payload: { name: "Untested policy project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/suites`,
      headers,
      payload: { name: "Suite" }
    });
    const suiteId = (suiteRes.json() as { data: { id: string } }).data.id;

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Case", priority: "medium" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Run", includeAll: true }
    });
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const firstResultRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/results`,
      headers,
      payload: { caseId, status: "passed" }
    });
    expect(firstResultRes.statusCode).toBe(200);

    const untestedRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/results`,
      headers,
      payload: { caseId, status: "untested" }
    });
    expect(untestedRes.statusCode).toBe(400);
    expect(untestedRes.json()).toMatchObject({ error: { code: "UNTESTED_NOT_ALLOWED" } });
  });

  it("creates and updates project case templates", async () => {
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
      payload: { name: "Case template project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const createRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/settings/templates`,
      headers: mutationHeaders,
      payload: {
        name: "Exploratory",
        description: "Lightweight testing",
        fields: ["title", "charter", "notes"],
        isDefault: true
      }
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json() as { data: { id: string; fields: string[]; isDefault: boolean } };
    expect(created.data.fields).toEqual(["title", "charter", "notes"]);
    expect(created.data.isDefault).toBe(true);

    const secondRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/settings/templates`,
      headers: mutationHeaders,
      payload: {
        name: "Regression",
        fields: ["title", "preconditions", "steps", "expectedResult"],
        isDefault: true
      }
    });
    expect(secondRes.statusCode).toBe(200);
    const second = secondRes.json() as { data: { id: string } };

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${project.data.id}/settings/templates/${second.data.id}`,
      headers: mutationHeaders,
      payload: { description: "Full regression format", isActive: false }
    });
    expect(updateRes.statusCode).toBe(200);
    expect((updateRes.json() as { data: { description: string; isActive: boolean } }).data).toMatchObject({
      description: "Full regression format",
      isActive: false
    });

    const listRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/settings/templates`
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json() as { data: Array<{ name: string; isDefault: boolean }> };
    expect(list.data.filter((template) => template.isDefault)).toHaveLength(1);
    expect(list.data.find((template) => template.name === "Regression")?.isDefault).toBe(true);
  });

  it("returns audit log query pagination metadata", async () => {
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
      payload: { name: "Audit query project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const auditRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/settings/audit-logs?page=1&pageSize=10&q=project`,
      headers: mutationHeaders
    });
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.json()).toMatchObject({
      data: {
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1
      }
    });

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/settings/audit-logs/export.csv?q=project`,
      headers: mutationHeaders
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.body).toContain(
      "id,project_id,project_name,action,actor_user_id,actor_email,entity_type,entity_id,changes,created_at"
    );

    const pruneRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/settings/audit-logs/retention-prune`,
      headers: mutationHeaders,
      payload: { olderThanDays: 365 }
    });
    expect(pruneRes.statusCode).toBe(200);
    expect(pruneRes.json()).toMatchObject({ data: { deleted: 0 } });
  });
});
