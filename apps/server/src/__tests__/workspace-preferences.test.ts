import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getMasterSuiteId } from "./testProjectSuites.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("workspace preferences API", () => {
  async function login() {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    return (loginRes.json() as { token: string }).token;
  }

  it("returns defaults and persists landing page, suite, and saved view", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Workspace prefs project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const initialRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/workspace-preferences`,
      headers
    });
    expect(initialRes.statusCode).toBe(200);
    const initial = (initialRes.json() as { data: { landingPage: string } }).data;
    expect(initial.landingPage).toBe("overview");

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/workspace-preferences`,
      headers,
      payload: {
        landingPage: "cases",
        defaultSuiteId: suiteId,
        defaultSavedViewId: "view-smoke"
      }
    });
    expect(patchRes.statusCode).toBe(200);
    const saved = (patchRes.json() as { data: { landingPage: string; defaultSuiteId: string } }).data;
    expect(saved.landingPage).toBe("cases");
    expect(saved.defaultSuiteId).toBe(suiteId);

    const reloadRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/workspace-preferences`,
      headers
    });
    const reloaded = (reloadRes.json() as { data: { defaultSavedViewId: string } }).data;
    expect(reloaded.defaultSavedViewId).toBe("view-smoke");
  });

});
