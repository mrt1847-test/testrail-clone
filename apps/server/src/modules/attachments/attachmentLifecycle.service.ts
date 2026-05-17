import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";
import { tombstoneStoragePath } from "../../domain/attachmentStorage.js";

export async function softDeleteAttachmentWithTombstone(
  prisma: PrismaClient,
  attachmentId: bigint,
  userId: bigint
) {
  const found = await prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null },
    select: { id: true, storagePath: true, resultId: true, fileName: true, entityType: true }
  });
  if (!found) {
    throw new AppError("NOT_FOUND", "attachment not found", 404);
  }

  await prisma.attachment.update({
    where: { id: attachmentId },
    data: {
      deletedAt: new Date(),
      updatedBy: userId,
      storagePath: tombstoneStoragePath(found.storagePath)
    }
  });

  return found;
}

export async function backfillTombstonedStoragePaths(prisma: PrismaClient, limit = 100) {
  const rows = await prisma.attachment.findMany({
    where: {
      deletedAt: { not: null },
      storagePath: { not: { startsWith: "tombstone/" } }
    },
    take: limit,
    select: { id: true, storagePath: true }
  });

  for (const row of rows) {
    await prisma.attachment.update({
      where: { id: row.id },
      data: { storagePath: tombstoneStoragePath(row.storagePath) }
    });
  }

  return rows.length;
}
