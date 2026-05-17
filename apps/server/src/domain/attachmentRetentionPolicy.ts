import { AppError } from "../common/errors/appError.js";
import { env } from "../config/env.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function attachmentRetentionCutoff(olderThanDays: number) {
  return new Date(Date.now() - olderThanDays * MS_PER_DAY);
}

export function resolveAttachmentRetentionDays(requested?: number) {
  const days = requested ?? env.attachmentRetentionDaysDefault;
  if (!Number.isFinite(days) || days < env.attachmentRetentionMinDays || days > env.attachmentRetentionMaxDays) {
    throw new AppError(
      "VALIDATION_ERROR",
      `olderThanDays must be between ${env.attachmentRetentionMinDays} and ${env.attachmentRetentionMaxDays}`,
      400,
      { olderThanDays: days }
    );
  }
  return Math.trunc(days);
}

export function attachmentRetentionPolicySummary() {
  return {
    defaultRetentionDays: env.attachmentRetentionDaysDefault,
    minRetentionDays: env.attachmentRetentionMinDays,
    maxRetentionDays: env.attachmentRetentionMaxDays,
    pruneBatchSize: env.attachmentRetentionPruneBatchSize,
    description:
      "Soft-deleted attachment metadata older than the retention window is permanently removed. Storage objects should already be tombstoned at delete time."
  };
}
