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
    const templates = (templatesRes.json() as { data: Array<{ id: string; name: string; systemKey: string | null }> }).data;
    expect(templates).toHaveLength(5);
    expect(templates.some((row) => row.systemKey === "test_case_steps")).toBe(true);

    const suiteRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/suites`,
      headers
    });
    const suiteId = (suiteRes.json() as { data: Array<{ id: string; isMaster: boolean }> }).data.find(
      (suite) => suite.isMaster
    )!.id;

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

    const exploratoryTemplate = templates.find((row) => row.systemKey === "exploratory_session");
    expect(exploratoryTemplate).toBeTruthy();

    const exploratoryRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: {
        title: "Checkout exploration",
        caseTemplateId: exploratoryTemplate!.id,
        mission: "Explore guest checkout",
        goals: "Find payment edge cases\nDocument blockers"
      }
    });
    expect(exploratoryRes.statusCode).toBe(200);
    const exploratory = (
      exploratoryRes.json() as { data: { mission: string; goals: string; customValues: Record<string, unknown> } }
    ).data;
    expect(exploratory.mission).toBe("Explore guest checkout");
    expect(exploratory.goals).toBe("Find payment edge cases\nDocument blockers");
    expect(exploratory.customValues.mission).toBeUndefined();
    expect(exploratory.customValues.goals).toBeUndefined();

    const aiTemplate = templates.find((row) => row.systemKey === "ai_evaluation");
    expect(aiTemplate).toBeTruthy();

    const aiCaseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: {
        title: "Summarize support ticket",
        caseTemplateId: aiTemplate!.id,
        aiInput: "Ticket: refund request for order #42",
        aiExpectedOutput: "Polite summary with next steps"
      }
    });
    expect(aiCaseRes.statusCode).toBe(200);
    const aiCase = (
      aiCaseRes.json() as {
        data: { id: string; aiInput: string; aiExpectedOutput: string; customValues: Record<string, unknown> };
      }
    ).data;
    expect(aiCase.aiInput).toContain("refund");
    expect(aiCase.aiExpectedOutput).toContain("summary");
    expect(aiCase.customValues.ai_input).toBeUndefined();

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "AI eval run", includeAll: false, caseIds: [aiCase.id] }
    });
    expect(runRes.statusCode).toBe(200);
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const instancesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/runs/${runId}/instances?page=1&pageSize=20`,
      headers
    });
    const testId = (instancesRes.json() as { data: Array<{ id: string }> }).data[0]!.id;

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/results`,
      headers,
      payload: {
        testId,
        status: "passed",
        aiActualOutput: "Refund approved; customer notified",
        aiQualityRating: 4,
        aiLatencyMs: 820,
        aiTraces: "retrieval:faq-v2\ncompletion:gpt-test"
      }
    });
    expect(resultRes.statusCode).toBe(200);
    const result = resultRes.json() as {
      aiActualOutput: string;
      aiQualityRating: number;
      aiLatencyMs: number;
      aiTraces: string;
      customValues: Record<string, unknown>;
    };
    expect(result.aiActualOutput).toContain("Refund approved");
    expect(result.aiQualityRating).toBe(4);
    expect(result.aiLatencyMs).toBe(820);
    expect(result.aiTraces).toContain("retrieval");
    expect(result.customValues.ai_quality_rating).toBeUndefined();
  });
});
