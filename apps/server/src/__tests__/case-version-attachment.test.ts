import { describe, expect, it } from "vitest";

import { env } from "../config/env.js";
import {
  findCaseVersionAttachmentSnapshot,
  parseCaseVersionAttachmentSnapshots,
  toPersistedAttachmentSnapshots
} from "../modules/cases/caseVersionAttachmentSnapshot.js";
import { CasesService } from "../modules/cases/cases.service.js";
import { ProjectsMemoryRepository } from "../modules/projects/projects.memory.repository.js";

describe("case version attachment snapshots", () => {
  it("parses canonical and legacy snapshot rows", () => {
    const parsed = parseCaseVersionAttachmentSnapshots([
      {
        attachmentId: "10",
        fileName: "legacy-canonical.png",
        contentType: "image/png",
        storageKey: "cases/1/legacy-canonical.png",
        entityType: "case",
        entityId: "1",
        createdAt: "2026-05-16T00:00:00.000Z"
      },
      {
        id: "11",
        fileName: "legacy-row.png",
        contentType: "image/png",
        storagePath: "cases/1/legacy-row.png",
        entityType: "case",
        entityId: "1",
        createdAt: "2026-05-16T00:00:00.000Z"
      }
    ]);
    expect(parsed).toHaveLength(2);
    expect(findCaseVersionAttachmentSnapshot(parsed, "11")?.storageKey).toBe("cases/1/legacy-row.png");
  });

  it("writes persisted snapshots with attachmentId and storageKey", () => {
    const rows = toPersistedAttachmentSnapshots([
      {
        id: "42",
        entityType: "case",
        entityId: "9",
        fileName: "spec.pdf",
        contentType: "application/pdf",
        storagePath: "cases/9/spec.pdf",
        createdAt: "2026-05-16T00:00:00.000Z"
      }
    ]);
    expect(rows[0]?.attachmentId).toBe("42");
    expect(rows[0]?.storageKey).toBe("cases/9/spec.pdf");
  });
});

describe("CasesService.getCaseVersionAttachmentDownload", () => {
  it("returns signed download URL from snapshot storageKey", async () => {
    const repo = new ProjectsMemoryRepository();
    const service = new CasesService(repo);
    const project = await repo.createProject({ name: "P", description: null, projectType: "single_repo" });
    const suite = (await repo.listSuitesByProject(project.id))[0]!;
    const section = await repo.createSection({ suiteId: suite.id, name: "S", description: null });
    const created = await repo.createCase({
      sectionId: section.id,
      title: "Case",
      priority: "medium",
      caseType: null,
      preconditions: null,
      customValues: {}
    });
    const version = await repo.createCaseVersionSnapshot(created.id, "seed");
    if (!version) throw new Error("expected version");
    version.attachmentSnapshots = [
      {
        id: "99",
        entityType: "case",
        entityId: created.id.toString(),
        fileName: "diagram.png",
        contentType: "image/png",
        storagePath: `cases/${created.id.toString()}/diagram.png`,
        createdAt: new Date().toISOString()
      }
    ];

    const download = await service.getCaseVersionAttachmentDownload(created.id, version.versionNo, "99");
    expect(download.fileName).toBe("diagram.png");
    expect(download.downloadUrl).toContain(encodeURIComponent(`cases/${created.id.toString()}/diagram.png`));
  });

  it("returns 404 when attachment id is not in snapshot", async () => {
    const repo = new ProjectsMemoryRepository();
    const service = new CasesService(repo);
    const project = await repo.createProject({ name: "P", description: null, projectType: "single_repo" });
    const suite = (await repo.listSuitesByProject(project.id))[0]!;
    const section = await repo.createSection({ suiteId: suite.id, name: "S", description: null });
    const created = await repo.createCase({
      sectionId: section.id,
      title: "Case",
      priority: "medium",
      caseType: null,
      preconditions: null,
      customValues: {}
    });
    const version = await repo.createCaseVersionSnapshot(created.id, "seed");
    if (!version) throw new Error("expected version");
    await expect(
      service.getCaseVersionAttachmentDownload(created.id, version.versionNo, "missing")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);

describe.skipIf(!integrationEnabled)("case version attachment download API (prisma)", () => {
  it("serves download URL for snapshot after restore", async () => {
    process.env.USE_IN_MEMORY_REPOSITORY = "false";
    const { buildApp } = await import("../app.js");
    const app = buildApp();
    await app.ready();
    try {
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
        payload: { name: `Version attach ${Date.now()}` }
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

      const caseRes = await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers,
        payload: { title: "Attachment case", priority: "medium" }
      });
      const caseId = (caseRes.json() as { data: { id: string } }).data.id;

      const attachRes = await app.inject({
        method: "POST",
        url: `/api/cases/${caseId}/attachments`,
        headers,
        payload: {
          fileName: "versioned.txt",
          contentType: "text/plain",
          storagePath: `cases/${caseId}/versioned.txt`
        }
      });
      expect(attachRes.statusCode).toBe(200);
      const attachmentId = String((attachRes.json() as { id: string | number }).id);

      await app.inject({
        method: "PATCH",
        url: `/api/cases/${caseId}`,
        headers,
        payload: { title: "Attachment case v2" }
      });

      const versionsRes = await app.inject({
        method: "GET",
        url: `/api/cases/${caseId}/versions?page=1&pageSize=10`,
        headers
      });
      const versions = (
        versionsRes.json() as {
          data: Array<{ id: string | number; versionNo: number; attachmentSnapshots: unknown[] }>;
        }
      ).data;
      const withAttachment = versions.find((v) => Array.isArray(v.attachmentSnapshots) && v.attachmentSnapshots.length > 0);
      expect(withAttachment).toBeDefined();
      const versionNo = withAttachment!.versionNo;
      const versionId = String(withAttachment!.id);

      const restoreRes = await app.inject({
        method: "POST",
        url: `/api/cases/${caseId}/versions/${versionId}/restore`,
        headers,
        payload: {}
      });
      expect(restoreRes.statusCode).toBe(200);

      const downloadRes = await app.inject({
        method: "GET",
        url: `/api/cases/${caseId}/versions/${versionNo}/attachments/${attachmentId}/download`,
        headers
      });
      expect(downloadRes.statusCode).toBe(200);
      const body = downloadRes.json() as { data: { downloadUrl: string; fileName: string } };
      expect(body.data.fileName).toBe("versioned.txt");
      expect(body.data.downloadUrl).toContain("versioned.txt");
    } finally {
      await app.close();
    }
  });
});
