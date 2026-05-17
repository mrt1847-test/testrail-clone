import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";
import {
  assertAttachmentStoragePathAllowed,
  buildAttachmentStoragePath,
  createSignedDownloadTarget,
  entityTypeToStorageEntity,
  isTombstonedStoragePath
} from "../../domain/attachmentStorage.js";
import {
  ATTACHMENT_MANIFEST_VERSION,
  decodeAttachmentContentBase64,
  encodeAttachmentContentBase64,
  type AttachmentImportIssue,
  type AttachmentManifest,
  type AttachmentManifestEntry
} from "../../domain/attachmentImportExport.js";
import {
  getLocalAttachmentBlob,
  hasLocalAttachmentBlob,
  putLocalAttachmentBlob
} from "./localAttachmentBlobStore.js";

export type AttachmentExportFilters = {
  caseId?: bigint;
  runId?: bigint;
  includeContent?: boolean;
  includeDownloadUrls?: boolean;
};

export type AttachmentImportOptions = {
  dryRun?: boolean;
  replaceExisting?: boolean;
};

export type AttachmentImportSummary = {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  withContent: number;
};

async function resolveResultIdsForRun(prisma: PrismaClient, projectId: bigint, runId: bigint) {
  const run = await prisma.testRun.findFirst({
    where: { id: runId, projectId, deletedAt: null },
    select: { id: true }
  });
  if (!run) return null;
  const results = await prisma.testResult.findMany({
    where: { instance: { runId } },
    select: { id: true }
  });
  return results.map((row) => row.id);
}

export async function buildProjectAttachmentManifest(
  prisma: PrismaClient,
  projectId: bigint,
  filters: AttachmentExportFilters = {}
): Promise<AttachmentManifest> {
  let rows: Array<{
    id: bigint;
    entityType: string;
    entityId: bigint;
    resultId: bigint | null;
    fileName: string;
    contentType: string | null;
    storagePath: string;
    fileSize: bigint | null;
  }>;

  if (filters.caseId) {
    const stepIds = (
      await prisma.testCaseStep.findMany({
        where: { testCaseId: filters.caseId },
        select: { id: true }
      })
    ).map((row) => row.id);
    rows = await prisma.attachment.findMany({
      where: {
        projectId,
        deletedAt: null,
        OR: [
          { entityType: "case", entityId: filters.caseId },
          ...(stepIds.length > 0
            ? [{ entityType: "case_step", entityId: { in: stepIds } }]
            : [])
        ]
      },
      orderBy: { id: "asc" },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        resultId: true,
        fileName: true,
        contentType: true,
        storagePath: true,
        fileSize: true
      }
    });
  } else if (filters.runId) {
    const resultIds = await resolveResultIdsForRun(prisma, projectId, filters.runId);
    if (!resultIds) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    rows = await prisma.attachment.findMany({
      where: {
        projectId,
        deletedAt: null,
        entityType: "result",
        resultId: { in: resultIds }
      },
      orderBy: { id: "asc" },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        resultId: true,
        fileName: true,
        contentType: true,
        storagePath: true,
        fileSize: true
      }
    });
  } else {
    rows = await prisma.attachment.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        resultId: true,
        fileName: true,
        contentType: true,
        storagePath: true,
        fileSize: true
      }
    });
  }

  const stepIds = rows.filter((row) => row.entityType === "case_step").map((row) => row.entityId);
  const steps =
    stepIds.length > 0
      ? await prisma.testCaseStep.findMany({
          where: { id: { in: stepIds } },
          select: { id: true, testCaseId: true }
        })
      : [];
  const caseIdByStepId = new Map(steps.map((row) => [row.id.toString(), row.testCaseId.toString()]));

  const attachments: AttachmentManifestEntry[] = [];
  for (const row of rows) {
    if (isTombstonedStoragePath(row.storagePath)) continue;
    const entry: AttachmentManifestEntry = {
      attachmentId: row.id.toString(),
      entityType: row.entityType as AttachmentManifestEntry["entityType"],
      entityId: row.entityId.toString(),
      resultId: row.resultId?.toString() ?? null,
      caseId: null,
      fileName: row.fileName,
      contentType: row.contentType ?? null,
      storagePath: row.storagePath,
      fileSize: row.fileSize != null ? Number(row.fileSize) : null
    };
    if (row.entityType === "case") {
      entry.caseId = row.entityId.toString();
    } else if (row.entityType === "case_step") {
      entry.caseId = caseIdByStepId.get(row.entityId.toString()) ?? null;
    }
    if (filters.includeContent) {
      const blob = getLocalAttachmentBlob(row.storagePath);
      if (blob) {
        entry.contentBase64 = encodeAttachmentContentBase64(blob);
      }
    }
    if (filters.includeDownloadUrls) {
      try {
        const signed = createSignedDownloadTarget(row.storagePath);
        (entry as AttachmentManifestEntry & { downloadUrl?: string }).downloadUrl = signed.downloadUrl;
      } catch {
        /* omit expired/tombstoned */
      }
    }
    attachments.push(entry);
  }

  return {
    version: ATTACHMENT_MANIFEST_VERSION,
    projectId: projectId.toString(),
    exportedAt: new Date().toISOString(),
    includeContent: Boolean(filters.includeContent),
    attachments
  };
}

async function assertEntityExists(
  prisma: PrismaClient,
  projectId: bigint,
  entry: AttachmentManifestEntry
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (entry.entityType === "case") {
    const row = await prisma.testCase.findFirst({
      where: { id: BigInt(entry.entityId), projectId, deletedAt: null }
    });
    if (!row) return { ok: false, message: `case ${entry.entityId} not found in project` };
    return { ok: true };
  }
  if (entry.entityType === "case_step") {
    const row = await prisma.testCaseStep.findFirst({
      where: { id: BigInt(entry.entityId), testCase: { projectId, deletedAt: null } }
    });
    if (!row) return { ok: false, message: `case step ${entry.entityId} not found in project` };
    return { ok: true };
  }
  const result = await prisma.testResult.findFirst({
    where: { id: BigInt(entry.entityId) },
    include: { instance: { include: { run: true } } }
  });
  if (!result || result.instance.run.projectId !== projectId) {
    return { ok: false, message: `result ${entry.entityId} not found in project` };
  }
  return { ok: true };
}

export async function importAttachmentManifest(
  prisma: PrismaClient,
  projectId: bigint,
  userId: bigint,
  manifest: AttachmentManifest,
  options: AttachmentImportOptions = {}
): Promise<{ summary: AttachmentImportSummary; issues: AttachmentImportIssue[] }> {
  if (manifest.projectId !== projectId.toString()) {
    throw new AppError("VALIDATION_ERROR", "manifest projectId does not match route project", 400);
  }

  const issues: AttachmentImportIssue[] = [];
  const summary: AttachmentImportSummary = {
    total: manifest.attachments.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    withContent: 0
  };

  for (let index = 0; index < manifest.attachments.length; index += 1) {
    const entry = manifest.attachments[index]!;
    const entityId = BigInt(entry.entityId);
    const exists = await assertEntityExists(prisma, projectId, entry);
    if (!exists.ok) {
      summary.failed += 1;
      issues.push({ index, code: "ENTITY_NOT_FOUND", message: exists.message });
      continue;
    }

    const duplicate = await prisma.attachment.findFirst({
      where: {
        projectId,
        entityType: entry.entityType,
        entityId,
        fileName: entry.fileName,
        deletedAt: null
      }
    });
    if (duplicate && !options.replaceExisting) {
      summary.skipped += 1;
      continue;
    }

    const storageEntity = entityTypeToStorageEntity(entry.entityType);
    if (!storageEntity) {
      summary.failed += 1;
      issues.push({ index, code: "INVALID_ENTITY", message: `unsupported entityType ${entry.entityType}` });
      continue;
    }

    let storagePath =
      entry.storagePath?.trim() ||
      buildAttachmentStoragePath({
        projectId,
        entity: storageEntity,
        entityId,
        fileName: entry.fileName
      });

    assertAttachmentStoragePathAllowed({
      projectId,
      entity: storageEntity,
      entityId,
      storagePath
    });

    let fileSize: bigint | undefined;
    if (entry.contentBase64?.trim()) {
      const bytes = decodeAttachmentContentBase64(entry.contentBase64);
      putLocalAttachmentBlob(storagePath, bytes);
      fileSize = BigInt(bytes.length);
      summary.withContent += 1;
    } else if (entry.storagePath?.trim() && hasLocalAttachmentBlob(entry.storagePath)) {
      const bytes = getLocalAttachmentBlob(entry.storagePath)!;
      putLocalAttachmentBlob(storagePath, bytes);
      fileSize = BigInt(bytes.length);
    }

    if (options.dryRun) {
      summary.imported += 1;
      continue;
    }

    if (duplicate && options.replaceExisting) {
      await prisma.attachment.update({
        where: { id: duplicate.id },
        data: { deletedAt: new Date() }
      });
    }

    const resultId =
      entry.entityType === "result"
        ? entityId
        : entry.resultId
          ? BigInt(entry.resultId)
          : null;

    await prisma.attachment.create({
      data: {
        projectId,
        entityType: entry.entityType,
        entityId,
        resultId,
        fileName: entry.fileName,
        contentType: entry.contentType ?? undefined,
        storagePath,
        fileSize,
        createdBy: userId
      }
    });
    summary.imported += 1;
  }

  return { summary, issues };
}
