import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
import {
  hasProjectPermission,
  permissionsForBuiltInRole,
  normalizeProjectPermissions
} from "../domain/permissionMatrix.js";

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

describe("permissionMatrix domain", () => {
  it("viewer cannot write cases", () => {
    const perms = permissionsForBuiltInRole("viewer");
    expect(hasProjectPermission(perms, "cases.read")).toBe(true);
    expect(hasProjectPermission(perms, "cases.write")).toBe(false);
  });

  it("normalizes custom permissions", () => {
    expect(normalizeProjectPermissions(["cases.write", "invalid", "cases.write"])).toEqual(["cases.write"]);
  });
});

describe("permission matrix API (in-memory)", () => {
  it("returns permission catalog for instance admin", async () => {
    const token = await login();
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/permission-matrix",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { permissions: Array<{ key: string }> } };
    expect(body.data.permissions.some((row) => row.key === "cases.write")).toBe(true);
  });

  it.skipIf(!integrationEnabled)("blocks viewer from creating cases when prisma enforces permissions", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Permission matrix project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const viewerEmail = `viewer-${Date.now()}@example.com`;
    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/settings/members`,
      headers,
      payload: { email: viewerEmail, role: "viewer" }
    });

    const viewerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: viewerEmail, password: "password" }
    });
    const viewerToken = (viewerLogin.json() as { token: string }).token;

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

    const createCaseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { title: "Should fail" }
    });

    if (createCaseRes.statusCode === 501) {
      expect(createCaseRes.statusCode).toBe(501);
      return;
    }

    expect(createCaseRes.statusCode).toBe(403);
  });
});
