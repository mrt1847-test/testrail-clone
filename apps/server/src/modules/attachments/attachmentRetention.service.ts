import type { PrismaClient } from "@prisma/client";

import { env } from "../../config/env.js";
import {
  attachmentRetentionCutoff,
  resolveAttachmentRetentionDays
} from "../../domain/attachmentRetentionPolicy.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import { backfillTombstonedStoragePaths } from "./attachmentLifecycle.service.js";

export type PruneDeletedAttachmentsInput = {
  projectId?: bigint;
  olderThanDays?: number;
  limit?: number;
  actorUserId?: bigint | null;
};

export type PruneDeletedAttachmentsResult = {
  deleted: number;
  cutoff: string;
  tombstoneBackfilled: number;
};

export async function pruneDeletedAttachments(
  prisma: PrismaClient,
  input: PruneDeletedAttachmentsInput = {}
): Promise<PruneDeletedAttachmentsResult> {
  const olderThanDays = resolveAttachmentRetentionDays(input.olderThanDays);
  const cutoff = attachmentRetentionCutoff(olderThanDays);
  const limit = input.limit ?? env.attachmentRetentionPruneBatchSize;

  let tombstoneBackfilled = 0;
  for (let pass = 0; pass < 5; pass += 1) {
    const updated = await backfillTombstonedStoragePaths(prisma, Math.min(limit, 100));
    tombstoneBackfilled += updated;
    if (updated < 100) break;
  }

  const rows = await prisma.attachment.findMany({
    where: {
      ...(input.projectId ? { projectId: input.projectId } : {}),
      deletedAt: { not: null, lt: cutoff }
    },
    take: limit,
    select: { id: true, projectId: true }
  });

  if (rows.length === 0) {
    return { deleted: 0, cutoff: cutoff.toISOString(), tombstoneBackfilled };
  }

  const deleted = await prisma.attachment.deleteMany({
    where: { id: { in: rows.map((row) => row.id) } }
  });

  if (input.actorUserId && input.projectId) {
    await recordActivityEvent(prisma, {
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      entityType: "attachment",
      entityId: "retention-prune",
      eventType: "attachment.retention_pruned",
      title: "Attachment retention prune",
      body: `${deleted.count} soft-deleted attachment(s) removed`,
      payload: {
        olderThanDays,
        cutoff: cutoff.toISOString(),
        deleted: deleted.count,
        tombstoneBackfilled
      }
    });
  }

  return {
    deleted: deleted.count,
    cutoff: cutoff.toISOString(),
    tombstoneBackfilled
  };
}

export async function runScheduledAttachmentRetentionPrune(prisma: PrismaClient) {
  let totalDeleted = 0;
  let totalTombstoned = 0;

  for (let pass = 0; pass < 20; pass += 1) {
    const result = await pruneDeletedAttachments(prisma, {
      olderThanDays: env.attachmentRetentionDaysDefault,
      limit: env.attachmentRetentionPruneBatchSize
    });
    totalDeleted += result.deleted;
    totalTombstoned += result.tombstoneBackfilled;
    if (result.deleted < env.attachmentRetentionPruneBatchSize) break;
  }

  return { deleted: totalDeleted, tombstoneBackfilled: totalTombstoned };
}
