import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { env } from "../config/env.js";
import { buildApp } from "../app.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe.skipIf(!integrationEnabled)("project archive", () => {
  it("archives a project, blocks mutations, and restores", async () => {
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
      payload: { name: "Archive me" }
    });
    const project = projectRes.json() as { data: { id: string } };

    const suiteRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/suites`,
      headers,
      payload: { name: "Suite" }
    });
    const suite = suiteRes.json() as { data: { id: string } };

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suite.data.id}/sections`,
      headers,
      payload: { name: "Section" }
    });
    const section = sectionRes.json() as { data: { id: string } };

    const archiveRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/archive`,
      headers
    });
    expect(archiveRes.statusCode).toBe(200);
    expect(archiveRes.json()).toMatchObject({ data: { isArchived: true } });

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/projects/${project.data.id}`,
      headers
    });
    expect(detailRes.json()).toMatchObject({ data: { isArchived: true } });

    const blockedCaseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers,
      payload: { title: "Should fail" }
    });
    expect(blockedCaseRes.statusCode).toBe(403);
    expect(blockedCaseRes.json()).toMatchObject({ error: { code: "PROJECT_ARCHIVED" } });

    const restoreRes = await app.inject({
      method: "POST",
      url: `/api/projects/${project.data.id}/restore`,
      headers
    });
    expect(restoreRes.statusCode).toBe(200);
    expect(restoreRes.json()).toMatchObject({ data: { isArchived: false } });

    const allowedCaseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${section.data.id}/cases`,
      headers,
      payload: { title: "After restore" }
    });
    expect(allowedCaseRes.statusCode).toBe(200);
  });
});
