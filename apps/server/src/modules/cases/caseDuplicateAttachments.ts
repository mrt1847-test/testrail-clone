import type { PrismaClient } from "@prisma/client";

import {
  assertAttachmentStoragePathAllowed,
  buildAttachmentStoragePath,
  entityTypeToStorageEntity
} from "../../domain/attachmentStorage.js";
import {
  getLocalAttachmentBlob,
  hasLocalAttachmentBlob,
  putLocalAttachmentBlob
} from "../attachments/localAttachmentBlobStore.js";

type AttachmentRow = {
  id: bigint;
  projectId: bigint;
  entityType: string;
  entityId: bigint;
  fileName: string;
  contentType: string | null;
  storagePath: string;
  fileSize: bigint | null;
};

async function cloneAttachmentToEntity(
  prisma: PrismaClient,
  userId: bigint,
  source: AttachmentRow,
  targetEntityType: "case" | "case_step",
  targetEntityId: bigint
) {
  const storageEntity = entityTypeToStorageEntity(targetEntityType);
  if (!storageEntity) return;

  const storagePath = buildAttachmentStoragePath({
    projectId: source.projectId,
    entity: storageEntity,
    entityId: targetEntityId,
    fileName: source.fileName
  });
  assertAttachmentStoragePathAllowed({
    projectId: source.projectId,
    entity: storageEntity,
    entityId: targetEntityId,
    storagePath
  });

  if (hasLocalAttachmentBlob(source.storagePath)) {
    const bytes = getLocalAttachmentBlob(source.storagePath);
    if (bytes) putLocalAttachmentBlob(storagePath, bytes);
  }

  await prisma.attachment.create({
    data: {
      projectId: source.projectId,
      entityType: targetEntityType,
      entityId: targetEntityId,
      fileName: source.fileName,
      contentType: source.contentType,
      storagePath,
      fileSize: source.fileSize,
      createdBy: userId
    }
  });
}

export async function copyCaseAttachmentsForDuplicate(
  prisma: PrismaClient,
  userId: bigint,
  sourceCaseId: bigint,
  targetCaseId: bigint,
  stepIdMap: Map<bigint, bigint>
) {
  const select = {
    id: true,
    projectId: true,
    entityType: true,
    entityId: true,
    fileName: true,
    contentType: true,
    storagePath: true,
    fileSize: true
  } as const;

  const caseAttachments = await prisma.attachment.findMany({
    where: { entityType: "case", entityId: sourceCaseId, deletedAt: null },
    select
  });
  for (const row of caseAttachments) {
    await cloneAttachmentToEntity(prisma, userId, row, "case", targetCaseId);
  }

  const sourceStepIds = [...stepIdMap.keys()];
  if (sourceStepIds.length === 0) return;

  const stepAttachments = await prisma.attachment.findMany({
    where: { entityType: "case_step", entityId: { in: sourceStepIds }, deletedAt: null },
    select
  });
  for (const row of stepAttachments) {
    const targetStepId = stepIdMap.get(row.entityId);
    if (targetStepId == null) continue;
    await cloneAttachmentToEntity(prisma, userId, row, "case_step", targetStepId);
  }
}
