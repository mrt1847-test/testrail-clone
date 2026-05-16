import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import {
  DEFAULT_CASE_TEMPLATE_DEFINITIONS,
  DEFAULT_CASE_TEMPLATE_SYSTEM_KEYS,
  templateFieldUsesExpectedResult,
  templateFieldUsesSteps
} from "../domain/defaultCaseTemplates.js";

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

describe("defaultCaseTemplates domain", () => {
  it("defines five TestRail-aligned templates", () => {
    expect(DEFAULT_CASE_TEMPLATE_SYSTEM_KEYS).toHaveLength(5);
    expect(DEFAULT_CASE_TEMPLATE_DEFINITIONS.map((row) => row.name)).toEqual([
      "Test Case (Text)",
      "Test Case (Steps)",
      "Exploratory Session",
      "Behaviour Driven Development",
      "AI Evaluation"
    ]);
    expect(templateFieldUsesSteps(DEFAULT_CASE_TEMPLATE_DEFINITIONS[1]!.fields)).toBe(true);
    expect(templateFieldUsesExpectedResult(DEFAULT_CASE_TEMPLATE_DEFINITIONS[0]!.fields)).toBe(true);
  });
});

describe("default case templates API (in-memory)", () => {
  it("seeds templates on project create and persists template on case", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Template seed project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const templatesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/settings/templates`,
      headers
    });
    const templates = (templatesRes.json() as { data: Array<{ name: string; systemKey: string | null }> }).data;
    expect(templates).toHaveLength(5);
    expect(templates.some((row) => row.systemKey === "test_case_steps")).toBe(true);

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/suites`,
      headers,
      payload: { name: "Suite A" }
    });
    const suiteId = (suiteRes.json() as { data: { id: string } }).data.id;

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Section A" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const textTemplate = templates.find((row) => row.systemKey === "test_case_text");
    expect(textTemplate).toBeTruthy();

    const createRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: {
        title: "Text template case",
        caseTemplateId: textTemplate!.id,
        expectedResult: "User sees confirmation"
      }
    });
    expect(createRes.statusCode).toBe(200);
    const created = (createRes.json() as { data: { caseTemplateId: string; expectedResult: string } }).data;
    expect(created.caseTemplateId).toBe(textTemplate!.id);
    expect(created.expectedResult).toBe("User sees confirmation");
  });
});
