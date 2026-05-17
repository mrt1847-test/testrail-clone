import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getMasterSuiteId } from "./testProjectSuites.js";
import {
  computeTokenExpiresAt,
  isTokenExpired,
  normalizeApiTokenScopes,
  tokenHasScopes
} from "../domain/apiTokenScopes.js";

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

describe("apiTokenScopes domain", () => {
  it("normalizes unknown scopes to defaults", () => {
    expect(normalizeApiTokenScopes(["automation:write", "invalid"])).toEqual(["automation:write"]);
  });

  it("detects expired tokens", () => {
    const past = new Date(Date.now() - 1000);
    expect(isTokenExpired(past)).toBe(true);
    expect(isTokenExpired(computeTokenExpiresAt(7))).toBe(false);
  });

  it("checks required scopes", () => {
    expect(tokenHasScopes(["automation:read"], "automation:read")).toBe(true);
    expect(tokenHasScopes(["automation:read"], "automation:write")).toBe(false);
  });
});

describe("API token scopes and expiration (in-memory)", () => {
  it("creates token with scopes and rejects write without scope", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Token scope project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const createRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/tokens`,
      headers,
      payload: {
        name: "read-only",
        scopes: ["automation:read"],
        expiresInDays: 30
      }
    });
    expect(createRes.statusCode).toBe(200);
    const created = createRes.json() as {
      data: { scopes: string[]; expiresAt: string | null };
      rawToken: string;
    };
    expect(created.data.scopes).toEqual(["automation:read"]);
    expect(created.data.expiresAt).toBeTruthy();

    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const runRes = await app.inject({
      method: "POST",
      url: "/api/automation/runs",
      headers: { authorization: `Bearer ${created.rawToken}` },
      payload: {
        projectId,
        suiteId,
        name: "CI run",
        includeAll: true
      }
    });
    expect(runRes.statusCode).toBe(403);
    const forbidden = runRes.json() as { error?: { message?: string } };
    expect(forbidden.error?.message).toContain("automation:write");
  });

  it("rejects expired tokens", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Expired token project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const createRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/tokens`,
      headers,
      payload: {
        name: "expired",
        scopes: ["automation:write"],
        expiresInDays: 1
      }
    });
    const created = createRes.json() as { data: { id: string }; rawToken: string };

    const listRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/tokens`,
      headers
    });
    const rows = (listRes.json() as { data: Array<{ id: string; expiresAt: string }> }).data;
    const row = rows.find((item) => item.id === created.data.id);
    expect(row?.expiresAt).toBeTruthy();

    const scopesRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/tokens/scopes`,
      headers
    });
    expect(scopesRes.statusCode).toBe(200);
    const scopePayload = scopesRes.json() as { data: Array<{ scope: string }> };
    expect(scopePayload.data.some((item) => item.scope === "automation:write")).toBe(true);
  });
});
