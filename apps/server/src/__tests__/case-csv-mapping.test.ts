import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
import {
  applyCaseCsvColumnMapping,
  extractCsvHeaders,
  suggestCaseCsvColumnMapping,
  validateCaseCsvColumnMapping
} from "../domain/caseCsvMapping.js";

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

describe("caseCsvMapping domain", () => {
  it("suggests canonical targets from common header aliases", () => {
    const mapping = suggestCaseCsvColumnMapping(["Test Case", "References", "Section ID", "Unknown"]);
    expect(mapping["Test Case"]).toBe("title");
    expect(mapping.References).toBe("refs");
    expect(mapping["Section ID"]).toBe("section_id");
    expect(mapping.Unknown).toBe("");
  });

  it("applies mapping before row validation fields are read", () => {
    const rows = applyCaseCsvColumnMapping(
      [{ "Test Case": "Login", Priority: "High" }],
      { "Test Case": "title", Priority: "priority" }
    );
    expect(rows[0]?.title).toBe("Login");
    expect(rows[0]?.priority).toBe("High");
  });

  it("requires title mapping coverage", () => {
    const issues = validateCaseCsvColumnMapping({ Notes: "comment" });
    expect(issues.some((issue) => issue.code === "MAPPING_REQUIRED" && issue.field === "title")).toBe(true);
  });

  it("extracts headers from quoted CSV", () => {
    expect(extractCsvHeaders('"Case Title",priority\n"One",High')).toEqual(["Case Title", "priority"]);
  });
});

describe("case CSV mapping API (in-memory)", () => {
  it("returns core import profile without prisma", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "CSV profile project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const profileRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/cases/import/csv/profile`,
      headers
    });
    expect(profileRes.statusCode).toBe(200);
    const profile = (profileRes.json() as { data: { coreFields: Array<{ key: string }> } }).data;
    expect(profile.coreFields.some((field) => field.key === "title")).toBe(true);

    const suggestRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/cases/import/csv/suggest-mapping`,
      headers,
      payload: { headers: ["Name", "Refs"] }
    });
    expect(suggestRes.statusCode).toBe(200);
    const suggested = (suggestRes.json() as { data: { mapping: Record<string, string> } }).data.mapping;
    expect(suggested.Name).toBe("title");
    expect(suggested.Refs).toBe("refs");
  });
});

describe.skipIf(!integrationEnabled)("case CSV import with mapping (prisma)", () => {
  it("imports rows using explicit column mapping", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Mapped import project" }
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

    const csv = ["Case Title,Priority", '"Mapped case",High'].join("\n");
    const dryRunRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/cases/import/csv`,
      headers,
      payload: {
        csv,
        dryRun: true,
        columnMapping: { "Case Title": "title", Priority: "priority" },
        sectionId
      }
    });
    expect(dryRunRes.statusCode).toBe(200);
    const body = dryRunRes.json() as { data: { summary: { validRows: number; invalidRows: number } } };
    expect(body.data.summary.validRows).toBe(1);
    expect(body.data.summary.invalidRows).toBe(0);
  });
});
