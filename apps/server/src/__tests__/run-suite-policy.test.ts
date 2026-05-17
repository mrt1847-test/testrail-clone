import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import { assertExplicitCaseIdsBelongToRunSuite } from "../domain/runSuitePolicy.js";
import { AppError } from "../common/errors/appError.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
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

describe("runSuitePolicy domain", () => {
  it("rejects case ids outside the run suite", () => {
    expect(() =>
      assertExplicitCaseIdsBelongToRunSuite([1n, 2n], [{ id: 1n, suiteId: 10n }], 10n, { multiSuiteProject: true })
    ).toThrow(AppError);
    try {
      assertExplicitCaseIdsBelongToRunSuite([1n, 2n], [{ id: 1n, suiteId: 10n }], 10n, { multiSuiteProject: true });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("RUN_SUITE_CASE_MISMATCH");
      expect(appError.statusCode).toBe(409);
    }
  });
});

describe("multi-suite run policy (in-memory)", () => {
  it("rejects creating a run with cases from another suite", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Multi suite runs", projectType: "multi_suite" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suiteARes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/suites`,
      headers,
      payload: { name: "Suite A" }
    });
    const suiteAId = (suiteARes.json() as { data: { id: string } }).data.id;

    const suiteBRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/suites`,
      headers,
      payload: { name: "Suite B" }
    });
    const suiteBId = (suiteBRes.json() as { data: { id: string } }).data.id;

    const sectionARes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteAId}/sections`,
      headers,
      payload: { name: "Section A" }
    });
    const sectionAId = (sectionARes.json() as { data: { id: string } }).data.id;

    const sectionBRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteBId}/sections`,
      headers,
      payload: { name: "Section B" }
    });
    const sectionBId = (sectionBRes.json() as { data: { id: string } }).data.id;

    const caseARes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionAId}/cases`,
      headers,
      payload: { title: "Case in suite A" }
    });
    const caseAId = (caseARes.json() as { data: { id: string } }).data.id;

    const caseBRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionBId}/cases`,
      headers,
      payload: { title: "Case in suite B" }
    });
    const caseBId = (caseBRes.json() as { data: { id: string } }).data.id;

    const mixedRun = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: {
        suiteId: suiteAId,
        name: "Mixed suite run",
        includeAll: false,
        caseIds: [caseAId, caseBId]
      }
    });
    expect(mixedRun.statusCode).toBe(409);
    const mixedBody = mixedRun.json() as { error: { code: string } };
    expect(mixedBody.error.code).toBe("RUN_SUITE_CASE_MISMATCH");

    const validRun = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: {
        suiteId: suiteAId,
        name: "Single suite run",
        includeAll: false,
        caseIds: [caseAId]
      }
    });
    expect(validRun.statusCode).toBe(200);
  });
});

describe.skipIf(!integrationEnabled)("multi-suite run policy (prisma)", () => {
  it("rejects add_run v2 when case_ids span suites", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "V2 multi suite", projectType: "multi_suite" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const suiteARes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/suites`,
      headers,
      payload: { name: "V2 Suite A" }
    });
    const suiteAId = (suiteARes.json() as { data: { id: string } }).data.id;

    const suiteBRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/suites`,
      headers,
      payload: { name: "V2 Suite B" }
    });
    const suiteBId = (suiteBRes.json() as { data: { id: string } }).data.id;

    const sectionAId = (
      await app.inject({
        method: "POST",
        url: `/api/suites/${suiteAId}/sections`,
        headers,
        payload: { name: "A" }
      })
    ).json().data.id as string;

    const sectionBId = (
      await app.inject({
        method: "POST",
        url: `/api/suites/${suiteBId}/sections`,
        headers,
        payload: { name: "B" }
      })
    ).json().data.id as string;

    const caseAId = (
      await app.inject({
        method: "POST",
        url: `/api/sections/${sectionAId}/cases`,
        headers,
        payload: { title: "A case" }
      })
    ).json().data.id as string;

    const caseBId = (
      await app.inject({
        method: "POST",
        url: `/api/sections/${sectionBId}/cases`,
        headers,
        payload: { title: "B case" }
      })
    ).json().data.id as string;

    const v2Mixed = await app.inject({
      method: "POST",
      url: `/api/v2/add_run/${projectId}`,
      headers,
      payload: {
        suite_id: Number(suiteAId),
        name: "V2 mixed",
        include_all: false,
        case_ids: [Number(caseAId), Number(caseBId)]
      }
    });
    expect(v2Mixed.statusCode).toBe(409);
  });
});
