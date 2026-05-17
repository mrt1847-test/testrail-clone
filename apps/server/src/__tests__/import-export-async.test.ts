import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../config/env.js";
import { LARGE_IMPORT_BYTES, shouldUseAsyncImport } from "../modules/importExport/importExportAsync.js";

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);
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

describe("importExportAsync helpers", () => {
  it("flags large CSV payloads for async import", () => {
    const small = "title\nCase";
    const large = "title\n" + "x".repeat(LARGE_IMPORT_BYTES);
    expect(shouldUseAsyncImport(small)).toBe(false);
    expect(shouldUseAsyncImport(large)).toBe(true);
  });
});

describe.skipIf(!integrationEnabled)("import/export async jobs (prisma)", () => {
  it("queues CSV import, polls job status, and completes validation", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Async import project" }
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

    const csv = ["Case Title,Priority", '"Async case",High'].join("\n");
    const queueRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/cases/import/csv/async`,
      headers,
      payload: {
        csv,
        dryRun: true,
        columnMapping: { "Case Title": "title", Priority: "priority" },
        sectionId
      }
    });
    expect(queueRes.statusCode).toBe(202);
    const jobId = (queueRes.json() as { data: { job: { id: string } } }).data.job.id;

    let detailStatus = "pending";
    for (let attempt = 0; attempt < 30 && detailStatus === "pending"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const detailRes = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/import-jobs/${jobId}`,
        headers
      });
      expect(detailRes.statusCode).toBe(200);
      const detail = detailRes.json() as { data: { job: { status: string }; resultReady: boolean } };
      detailStatus = detail.data.job.status;
      if (detail.data.resultReady) break;
    }

    const finalRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/import-jobs/${jobId}`,
      headers
    });
    const finalBody = finalRes.json() as {
      data: { job: { status: string }; summary: { validRows: number; invalidRows: number }; resultReady: boolean };
    };
    expect(finalBody.data.resultReady).toBe(true);
    expect(finalBody.data.job.status).toBe("completed");
    expect(finalBody.data.summary.validRows).toBe(1);
    expect(finalBody.data.summary.invalidRows).toBe(0);
  });

  it("queues case CSV export and downloads when completed", async () => {
    const token = await login();
    const headers = { authorization: `Bearer ${token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Async export project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const queueRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/cases/export/async`,
      headers,
      payload: { format: "csv" }
    });
    expect(queueRes.statusCode).toBe(202);
    const jobId = (queueRes.json() as { data: { job: { id: string } } }).data.job.id;

    let status = "pending";
    for (let attempt = 0; attempt < 30 && (status === "pending" || status === "processing"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const detailRes = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/export-jobs/${jobId}`,
        headers
      });
      status = (detailRes.json() as { data: { job: { status: string } } }).data.job.status;
    }
    expect(status).toBe("completed");

    const downloadRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/export-jobs/${jobId}/download`,
      headers
    });
    expect(downloadRes.statusCode).toBe(200);
    expect(String(downloadRes.headers["content-type"])).toContain("text/csv");
  });
});
