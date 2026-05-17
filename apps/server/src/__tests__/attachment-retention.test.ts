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

describe("attachment retention policy API", () => {
  it.skipIf(!integrationEnabled)("prunes soft-deleted attachments past retention window", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.com", password: "password" }
    });
    const headers = { authorization: `Bearer ${(loginRes.json() as { token: string }).token}` };

    const projectRes = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { name: "Attachment retention project" }
    });
    const projectId = (projectRes.json() as { data: { id: string } }).data.id;

    const policyRes = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/settings/attachments/retention-policy`,
      headers
    });
    expect(policyRes.statusCode).toBe(200);
    const policy = (policyRes.json() as { data: { defaultRetentionDays: number; minRetentionDays: number } }).data;
    expect(policy.defaultRetentionDays).toBeGreaterThanOrEqual(policy.minRetentionDays);

    const suiteId = await getMasterSuiteId(app, projectId, headers);
    const runRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/runs`,
      headers,
      payload: { suiteId, name: "Retention run", includeAll: true }
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

    const resultRes = await app.inject({
      method: "POST",
      url: `/api/tests/${testId}/results`,
      headers,
      payload: { status: "passed" }
    });
    const resultId = (resultRes.json() as { id: string }).id;

    const presignRes = await app.inject({
      method: "POST",
      url: `/api/results/${resultId}/attachments/presign`,
      headers,
      payload: { fileName: "old.txt", contentType: "text/plain" }
    });
    const storagePath = (presignRes.json() as { data: { storagePath: string } }).data.storagePath;

    const registerRes = await app.inject({
      method: "POST",
      url: "/api/attachments",
      headers,
      payload: { resultId, fileName: "old.txt", storagePath }
    });
    const attachmentId = (registerRes.json() as { data: { id: string } }).data.id;

    await app.inject({
      method: "DELETE",
      url: `/api/attachments/${attachmentId}`,
      headers
    });

    const staleCutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    if (env.databaseUrl) {
      const { getPrismaClient } = await import("../db/prisma.js");
      const prisma = getPrismaClient();
      await prisma.attachment.update({
        where: { id: BigInt(attachmentId) },
        data: { deletedAt: staleCutoff }
      });
    }

    const pruneRes = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/settings/attachments/retention-prune`,
      headers,
      payload: { olderThanDays: 90 }
    });
    expect(pruneRes.statusCode).toBe(200);
    expect((pruneRes.json() as { data: { deleted: number } }).data.deleted).toBeGreaterThanOrEqual(1);

    const goneRes = await app.inject({
      method: "GET",
      url: `/api/attachments/${attachmentId}`,
      headers
    });
    expect(goneRes.statusCode).toBe(404);
  });
});
