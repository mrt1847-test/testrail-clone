import { z } from "zod";

export const ATTACHMENT_MANIFEST_VERSION = 1;

export const attachmentEntityTypeSchema = z.enum(["case", "case_step", "result"]);

export const attachmentManifestEntrySchema = z.object({
  entityType: attachmentEntityTypeSchema,
  entityId: z.string().trim().min(1),
  resultId: z.string().trim().min(1).optional().nullable(),
  caseId: z.string().trim().min(1).optional().nullable(),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().optional().nullable(),
  storagePath: z.string().trim().optional().nullable(),
  fileSize: z.coerce.number().int().nonnegative().optional().nullable(),
  contentBase64: z.string().trim().optional().nullable(),
  attachmentId: z.string().trim().optional().nullable()
});

export const attachmentManifestSchema = z.object({
  version: z.literal(ATTACHMENT_MANIFEST_VERSION),
  projectId: z.string().trim().min(1),
  exportedAt: z.string().trim().min(1),
  includeContent: z.boolean().optional(),
  attachments: z.array(attachmentManifestEntrySchema)
});

export type AttachmentManifestEntry = z.infer<typeof attachmentManifestEntrySchema>;
export type AttachmentManifest = z.infer<typeof attachmentManifestSchema>;

export type AttachmentImportIssue = {
  index: number;
  code: string;
  message: string;
};

export function parseAttachmentManifestJson(raw: string): AttachmentManifest {
  const parsed = JSON.parse(raw) as unknown;
  return attachmentManifestSchema.parse(parsed);
}

export function serializeAttachmentManifest(manifest: AttachmentManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function decodeAttachmentContentBase64(value: string): Buffer {
  const trimmed = value.trim();
  const data = trimmed.includes(",") ? trimmed.split(",").pop() ?? trimmed : trimmed;
  return Buffer.from(data, "base64");
}

export function encodeAttachmentContentBase64(data: Buffer): string {
  return data.toString("base64");
}
