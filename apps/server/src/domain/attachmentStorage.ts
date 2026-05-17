import { AppError } from "../common/errors/appError.js";
import { env } from "../config/env.js";

export type AttachmentStorageEntity = "cases" | "case-steps" | "results";

export function attachmentStoragePrefix(
  projectId: bigint,
  entity: AttachmentStorageEntity,
  entityId: bigint
) {
  return `projects/${projectId.toString()}/${entity}/${entityId.toString()}`;
}

export function buildAttachmentStoragePath(input: {
  projectId: bigint;
  entity: AttachmentStorageEntity;
  entityId: bigint;
  fileName: string;
  nonce?: number;
}) {
  const safeName = input.fileName.replace(/[/\\]/g, "_").trim() || "file";
  const nonce = input.nonce ?? Date.now();
  return `${attachmentStoragePrefix(input.projectId, input.entity, input.entityId)}/${nonce}-${safeName}`;
}

export function isTombstonedStoragePath(storagePath: string) {
  const normalized = storagePath.replace(/^\/+/, "");
  return normalized.startsWith("tombstone/") || normalized.startsWith("local://tombstone/");
}

export function tombstoneStoragePath(storagePath: string) {
  if (isTombstonedStoragePath(storagePath)) return storagePath;
  const normalized = storagePath.replace(/^\/+/, "");
  return `tombstone/${normalized}`;
}

function legacyPrefixes(entity: AttachmentStorageEntity, entityId: bigint) {
  const id = entityId.toString();
  if (entity === "cases") return [`cases/${id}/`];
  if (entity === "case-steps") return [`case-steps/${id}/`, `case_steps/${id}/`];
  return [`results/${id}/`];
}

export function assertAttachmentStoragePathAllowed(input: {
  projectId: bigint;
  entity: AttachmentStorageEntity;
  entityId: bigint;
  storagePath: string;
}) {
  const normalized = input.storagePath.replace(/^\/+/, "");
  if (isTombstonedStoragePath(normalized)) {
    throw new AppError("VALIDATION_ERROR", "storage path is tombstoned", 400);
  }
  if (normalized.includes("..")) {
    throw new AppError("VALIDATION_ERROR", "invalid storage path", 400);
  }

  const allowedPrefixes = [
    `${attachmentStoragePrefix(input.projectId, input.entity, input.entityId)}/`,
    ...legacyPrefixes(input.entity, input.entityId)
  ];
  if (!allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new AppError("FORBIDDEN", "storage path outside project attachment boundary", 403);
  }
}

export function entityTypeToStorageEntity(entityType: string): AttachmentStorageEntity | null {
  if (entityType === "case") return "cases";
  if (entityType === "case_step") return "case-steps";
  if (entityType === "result") return "results";
  return null;
}

export function createSignedUploadTarget(storagePath: string, contentType?: string | null) {
  const expiresAt = new Date(Date.now() + env.storageUploadUrlTtlSeconds * 1000);
  const base = env.storagePublicBaseUrl.replace(/\/$/, "");
  return {
    storagePath,
    uploadUrl: `${base}/upload/${encodeURIComponent(storagePath)}`,
    method: "PUT" as const,
    headers: {
      "content-type": contentType ?? "application/octet-stream"
    },
    expiresAt
  };
}

export function createSignedDownloadTarget(storagePath: string) {
  if (isTombstonedStoragePath(storagePath)) {
    throw new AppError("NOT_FOUND", "attachment file removed", 404);
  }
  const expiresAt = new Date(Date.now() + env.storageSignedUrlTtlSeconds * 1000);
  const base = env.storagePublicBaseUrl.replace(/\/$/, "");
  return {
    downloadUrl: `${base}/download/${encodeURIComponent(storagePath)}?expires=${expiresAt.getTime()}`,
    expiresAt
  };
}
