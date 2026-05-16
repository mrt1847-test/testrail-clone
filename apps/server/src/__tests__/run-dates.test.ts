import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { buildRunDateWarnings, inheritRunDatesFromMilestone } from "../domain/runDates.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("runDates domain", () => {
  it("inherits milestone schedule when run dates omitted", () => {
    const inherited = inheritRunDatesFromMilestone(
      {},
      { startDate: new Date("2026-06-01T00:00:00.000Z"), dueDate: new Date("2026-06-30T00:00:00.000Z") }
    );
    expect(inherited.startedAt?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(inherited.dueOn?.toISOString()).toBe("2026-06-30T00:00:00.000Z");
  });

  it("warns when end date passed but run still open", () => {
    const warnings = buildRunDateWarnings({
      status: "open",
      startedAt: new Date("2026-05-01T00:00:00.000Z"),
      dueOn: new Date("2026-05-01T00:00:00.000Z"),
      closedAt: null,
      milestone: null,
      planName: null
    });
    expect(warnings.some((line) => line.includes("auto-close"))).toBe(true);
  });
});

describe("run schedule API", () => {
  async function login() {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    return (loginRes.json() as { token: string }).token;
  }

  it("creates run with optional dates and patches them while open", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Run dates project" }
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

    await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Case A" }
    });

    const createRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: {
        suiteId,
        name: "Scheduled run",
        includeAll: true,
        startedAt: "2026-07-01T00:00:00.000Z",
        dueOn: "2026-07-15T00:00:00.000Z"
      }
    });
    expect(createRes.statusCode).toBe(200);
    const runId = (createRes.json() as { run: { id: string; startedAt?: string; dueOn?: string } }).run.id;
    const created = (createRes.json() as { run: { startedAt?: string; dueOn?: string } }).run;
    expect(created.startedAt).toContain("2026-07-01");
    expect(created.dueOn).toContain("2026-07-15");

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/runs/${runId}`,
      headers,
      payload: { dueOn: "2026-07-20T00:00:00.000Z" }
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = (patchRes.json() as { data: { dueOn?: string } }).data;
    expect(patched.dueOn).toContain("2026-07-20");

    const invalidClosePatch = await app.inject({
      method: "PATCH",
      url: `/api/runs/${runId}`,
      headers,
      payload: { closedAt: "2026-07-21T00:00:00.000Z" }
    });
    expect(invalidClosePatch.statusCode).toBe(400);

    const closeRes = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/close`,
      headers
    });
    expect(closeRes.statusCode).toBe(200);
  });
});
