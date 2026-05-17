import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import { getMasterSuiteId } from "./testProjectSuites.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("custom field visibility", () => {
  it.skipIf(!integrationEnabled)("hides values on read and rejects writes for disallowed roles", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const { token } = loginRes.json() as { token: string };
    const ownerHeaders = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: ownerHeaders,
      payload: { name: "Visibility project" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const fieldRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/settings/custom-fields`,
      headers: ownerHeaders,
      payload: {
        name: "Manager only",
        systemName: "manager_only",
        fieldType: "text",
        visibility: { viewRoles: ["manager", "owner"], editRoles: ["manager", "owner"] }
      }
    });
    expect(fieldRes.statusCode).toBe(200);

    const suiteId = await getMasterSuiteId(app, project.data.id, ownerHeaders);
    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers: ownerHeaders,
      payload: { name: "SEC" }
    });
    const section = sectionRes.json() as { data: { id: string } };

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers: ownerHeaders,
      payload: { title: "Case", customValues: { manager_only: "secret" } }
    });
    expect(caseRes.statusCode).toBe(200);
    const createdCase = caseRes.json() as { data: { id: string; customValues: Record<string, unknown> } };
    expect(createdCase.data.customValues).toMatchObject({ manager_only: "secret" });

    const inviteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/settings/members`,
      headers: ownerHeaders,
      payload: { email: "tester-visibility@example.com", name: "Tester", role: "tester" }
    });
    expect(inviteRes.statusCode).toBe(200);

    const testerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "tester-visibility@example.com", password: "password" }
    });
    const testerToken = (testerLogin.json() as { token: string }).token;
    const testerHeaders = { authorization: `Bearer ${testerToken}` };

    const getCase = await app.inject({
      method: "GET",
      url: `/api/cases/${createdCase.data.id}`,
      headers: testerHeaders
    });
    expect(getCase.statusCode).toBe(200);
    const caseBody = getCase.json() as { data: { customValues: Record<string, unknown> } };
    expect(caseBody.data.customValues.manager_only).toBeUndefined();

    const forUse = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}/settings/custom-fields?scope=case&forUse=true`,
      headers: testerHeaders
    });
    const fields = (forUse.json() as { data: Array<{ systemName: string }> }).data;
    expect(fields.some((field) => field.systemName === "manager_only")).toBe(false);

    const deniedPatch = await app.inject({
      method: "PATCH",
      url: `/api/cases/${createdCase.data.id}`,
      headers: testerHeaders,
      payload: { customValues: { manager_only: "blocked" } }
    });
    expect(deniedPatch.statusCode).toBe(400);
    expect((deniedPatch.json() as { code: string }).code).toBe("FORBIDDEN_CUSTOM_FIELD");
  });
});
