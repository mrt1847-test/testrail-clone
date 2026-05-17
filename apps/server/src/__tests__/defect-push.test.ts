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

describe("defect push dialog API", () => {
  async function login() {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    return (loginRes.json() as { token: string }).token;
  }

  it("returns provider field mapping for push dialog", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Defect push fields project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const fieldsRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/integrations/defects/push-fields?provider=jira&runId=1&testId=2&resultId=3&resultStatus=failed&runName=Run&testTitle=Login`,
      headers
    });
    expect(fieldsRes.statusCode).toBe(200);
    const fields = (fieldsRes.json() as { data: { provider: string; fields: Array<{ key: string }> } }).data;
    expect(fields.provider).toBe("jira");
    expect(fields.fields.some((row) => row.key === "summary")).toBe(true);
  });

  it("pushes defect with custom fields and links back to result", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Defect push project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "PATCH",
      url: `/api/projects/${projectId}/integrations/defects`,
      headers,
      payload: {
        provider: "jira",
        isEnabled: true,
        issueUrlTemplate: "https://jira.example/browse/{key}",
        defaultProjectKey: "QA"
      }
    });

    const suiteId = await getMasterSuiteId(app, projectId, headers);
    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Push section" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Push defect case" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Push run", includeAll: false, caseIds: [caseId] }
    });
    const runId = (runRes.json() as { run: { id: string } }).run.id;

    const instancesRes = await app.inject({
      method: "GET",
      url: `/api/runs/${runId}?includeInstances=true`,
      headers
    });
    const testId = (
      instancesRes.json() as { data: { instances: Array<{ id: string }> } }
    ).data.instances[0]?.id;
    expect(testId).toBeTruthy();

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/results`,
      headers,
      payload: { status: "failed", comment: "Expected login error" }
    });
    expect(resultRes.statusCode).toBe(200);
    const resultId = (resultRes.json() as { id: string }).id;

    const pushRes = await app.inject({
      method: "POST",
      url: `/api/results/${resultId}/defects/push`,
      headers,
      payload: {
        provider: "jira",
        title: "Login failure",
        description: "Traceback body",
        defectKey: "QA-99",
        customFields: { issueType: "Bug", priority: "High" }
      }
    });
    expect(pushRes.statusCode).toBe(200);
    const pushed = (pushRes.json() as { data: { defectKey: string; url: string; customFields: Record<string, string> } })
      .data;
    expect(pushed.defectKey).toBe("QA-99");
    expect(pushed.url).toBe("https://jira.example/browse/QA-99");
    expect(pushed.customFields.issueType).toBe("Bug");

    const listRes = await app.inject({
      method: "GET",
      url: `/api/results/${resultId}/defects`,
      headers
    });
    const links = listRes.json() as Array<{ defectKey: string }>;
    expect(links.some((row) => row.defectKey === "QA-99")).toBe(true);
  });
});
