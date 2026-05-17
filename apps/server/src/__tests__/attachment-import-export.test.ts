import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import { encodeAttachmentContentBase64 } from "../domain/attachmentImportExport.js";
import { getMasterSuiteId } from "./testProjectSuites.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe.skipIf(!integrationEnabled)("attachment import/export", () => {
  async function login() {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    return (loginRes.json() as { token: string }).token;
  }

  it("exports and re-imports a case attachment manifest with inline content", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Attachment IE project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;
    const suiteId = await getMasterSuiteId(app, projectId, headers);

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/suites/${suiteId}/sections`,
      headers,
      payload: { name: "Attachments" }
    });
    const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

    const caseRes = await app.inject({
      method: "POST",
      url: `/api/sections/${sectionId}/cases`,
      headers,
      payload: { title: "Case with attachment" }
    });
    const caseId = (caseRes.json() as { data: { id: string } }).data.id;

    const attachRes = await app.inject({
      method: "POST",
      url: `/api/cases/${caseId}/attachments`,
      headers,
      payload: {
        fileName: "evidence.txt",
        contentType: "text/plain",
        storagePath: `projects/${projectId}/cases/${caseId}/evidence.txt`
      }
    });
    expect(attachRes.statusCode).toBe(200);

    const exportRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/attachments/export?includeContent=true&includeDownloadUrls=true`,
      headers
    });
    expect(exportRes.statusCode).toBe(200);
    const exported = JSON.parse(exportRes.body) as {
      attachments: Array<{ entityId: string; fileName: string; contentBase64?: string }>;
    };
    expect(exported.attachments.some((row) => row.fileName === "evidence.txt")).toBe(true);

    const importManifest = {
      version: 1,
      projectId,
      exportedAt: new Date().toISOString(),
      attachments: [
        {
          entityType: "case",
          entityId: caseId,
          caseId,
          fileName: "imported-proof.txt",
          contentType: "text/plain",
          contentBase64: encodeAttachmentContentBase64(Buffer.from("imported bytes"))
        }
      ]
    };

    const dryRunRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/attachments/import`,
      headers,
      payload: { manifest: JSON.stringify(importManifest), dryRun: true }
    });
    expect(dryRunRes.statusCode).toBe(200);
    const dryRun = (dryRunRes.json() as { data: { summary: { imported: number } } }).data;
    expect(dryRun.summary.imported).toBe(1);

    const importRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/attachments/import`,
      headers,
      payload: { manifest: JSON.stringify(importManifest) }
    });
    expect(importRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: "GET",
      url: `/api/cases/${caseId}/attachments`,
      headers
    });
    const links = listRes.json() as Array<{ fileName: string }>;
    expect(links.some((row) => row.fileName === "imported-proof.txt")).toBe(true);
  });
});
