import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

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

describe("case metadata fields API", () => {
  it("patches labels and refs without full edit payload", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Metadata patch project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

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
      payload: { name: "Metadata section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const createRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Tagged case", refs: "REQ-1" }
    });
    const caseId = (createRes.json() as { data: { id: string } }).data.id;

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/cases/${caseId}`,
      headers,
      payload: {
        refs: "REQ-9",
        labels: ["smoke", "smoke", "checkout"]
      }
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = (patchRes.json() as { data: { refs: string; labels: string[] } }).data;
    expect(patched.refs).toBe("REQ-9");
    expect(patched.labels).toEqual(["smoke", "checkout"]);
  });
});
