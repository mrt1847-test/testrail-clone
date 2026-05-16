import { z } from "zod";

/** Persisted on `TestCaseVersion.attachmentSnapshots` (JSON array). */
export const caseVersionAttachmentSnapshotSchema = z.object({
  attachmentId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().nullable().optional(),
  storageKey: z.string().min(1),
  entityType: z.enum(["case", "case_step"]).optional(),
  entityId: z.string().optional(),
  stepOrder: z.number().int().nullable().optional(),
  fileSize: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  createdBy: z.string().nullable().optional()
});

export type CaseVersionAttachmentSnapshot = z.infer<typeof caseVersionAttachmentSnapshotSchema>;

/** Normalize legacy rows (`id` + `storagePath`) and canonical shape (`attachmentId` + `storageKey`). */
export function parseCaseVersionAttachmentSnapshots(value: unknown): CaseVersionAttachmentSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const attachmentId =
      typeof row.attachmentId === "string"
        ? row.attachmentId
        : typeof row.id === "string"
          ? row.id
          : null;
    const storageKey =
      typeof row.storageKey === "string"
        ? row.storageKey
        : typeof row.storagePath === "string"
          ? row.storagePath
          : null;
    const fileName = typeof row.fileName === "string" ? row.fileName : null;
    if (!attachmentId || !storageKey || !fileName) return [];
    const parsed = caseVersionAttachmentSnapshotSchema.safeParse({
      attachmentId,
      fileName,
      contentType: typeof row.contentType === "string" ? row.contentType : null,
      storageKey,
      entityType: row.entityType === "case" || row.entityType === "case_step" ? row.entityType : undefined,
      entityId: typeof row.entityId === "string" ? row.entityId : undefined,
      stepOrder: typeof row.stepOrder === "number" ? row.stepOrder : null,
      fileSize: typeof row.fileSize === "string" ? row.fileSize : null,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : undefined,
      createdBy: typeof row.createdBy === "string" ? row.createdBy : null
    });
    return parsed.success ? [parsed.data] : [];
  });
}

export function findCaseVersionAttachmentSnapshot(
  snapshots: CaseVersionAttachmentSnapshot[],
  attachmentId: string
): CaseVersionAttachmentSnapshot | null {
  return snapshots.find((row) => row.attachmentId === attachmentId) ?? null;
}

/** Canonical JSON stored on new version writes (extends minimal BUILD_PLAN fields). */
export function toPersistedAttachmentSnapshots(
  rows: Array<{
    id: string;
    entityType: "case" | "case_step";
    entityId: string;
    stepOrder?: number | null;
    fileName: string;
    contentType?: string | null;
    storagePath: string;
    fileSize?: string | null;
    createdAt: string;
    createdBy?: string | null;
  }>
): CaseVersionAttachmentSnapshot[] {
  return rows.map((row) => ({
    attachmentId: row.id,
    fileName: row.fileName,
    contentType: row.contentType ?? null,
    storageKey: row.storagePath,
    entityType: row.entityType,
    entityId: row.entityId,
    stepOrder: row.stepOrder ?? null,
    fileSize: row.fileSize ?? null,
    createdAt: row.createdAt,
    createdBy: row.createdBy ?? null
  }));
}
