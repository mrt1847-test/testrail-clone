/** Client-side staging for case attachments before a caseId exists (UI-071 / CA-U03). */

export const CASE_AUTHORING_ATTACHMENT_MAX_FILES = 2;
export const CASE_AUTHORING_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CASE_AUTHORING_ATTACHMENT_ACCEPT = "image/*";

export type StagedCaseAttachmentStatus = "queued" | "uploading" | "uploaded" | "failed";

export type StagedCaseAttachment = {
  id: string;
  file: File;
  status: StagedCaseAttachmentStatus;
  message?: string;
  progress?: number;
};

export type StagedCaseAttachmentPatch = {
  status: StagedCaseAttachmentStatus;
  message?: string;
  progress?: number;
};

export function createStagedCaseAttachmentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `case-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function validateCaseAuthoringAttachmentFile(file: File): string | null {
  const type = (file.type || "").toLowerCase();
  if (!type.startsWith("image/")) {
    return `${file.name} must be an image file.`;
  }
  if (file.size <= 0) {
    return `${file.name} is empty.`;
  }
  if (file.size > CASE_AUTHORING_ATTACHMENT_MAX_BYTES) {
    return `${file.name} exceeds the ${Math.round(CASE_AUTHORING_ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB limit.`;
  }
  return null;
}

export function stageCaseAuthoringAttachments(
  current: StagedCaseAttachment[],
  incoming: File[]
): { next: StagedCaseAttachment[]; rejected: string[] } {
  const rejected: string[] = [];
  const next = [...current];
  for (const file of incoming) {
    const validationError = validateCaseAuthoringAttachmentFile(file);
    if (validationError) {
      rejected.push(validationError);
      continue;
    }
    const duplicate = next.some(
      (row) =>
        row.file.name === file.name &&
        row.file.size === file.size &&
        row.file.lastModified === file.lastModified
    );
    if (duplicate) continue;
    if (next.length >= CASE_AUTHORING_ATTACHMENT_MAX_FILES) {
      rejected.push(`You can stage up to ${CASE_AUTHORING_ATTACHMENT_MAX_FILES} images before saving.`);
      break;
    }
    next.push({ id: createStagedCaseAttachmentId(), file, status: "queued" });
  }
  return { next, rejected };
}

export function removeStagedCaseAttachment(
  current: StagedCaseAttachment[],
  id: string
): StagedCaseAttachment[] {
  return current.filter((row) => row.id !== id || row.status === "uploading");
}

export function canRemoveStagedCaseAttachment(status: StagedCaseAttachmentStatus): boolean {
  return status === "queued" || status === "failed" || status === "uploaded";
}

export function applyStagedCaseAttachmentPatch(
  current: StagedCaseAttachment[],
  id: string,
  patch: StagedCaseAttachmentPatch
): StagedCaseAttachment[] {
  return current.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

/** Files that still need an upload attempt (not yet on the server). */
export function pendingStagedCaseAttachments(files: StagedCaseAttachment[]): StagedCaseAttachment[] {
  return files.filter((row) => row.status === "queued" || row.status === "failed");
}

export function hasPendingStagedCaseAttachments(files: StagedCaseAttachment[]): boolean {
  return pendingStagedCaseAttachments(files).length > 0;
}

export function stagedCaseAttachmentStatusLabel(
  status: StagedCaseAttachmentStatus,
  progress?: number
): string {
  if (status === "queued") return "Queued";
  if (status === "uploading") {
    return progress != null && progress > 0
      ? `Uploading ${Math.min(100, Math.round(progress))}%`
      : "Uploading…";
  }
  if (status === "uploaded") return "Attached";
  return "Failed";
}

/** Upload only after body+steps succeeded for this caseId — never before create. */
export function shouldUploadStagedCaseAttachments(input: {
  caseId: number | null | undefined;
  bodySaved: boolean;
  stepsComplete: boolean;
  pendingCount: number;
}): boolean {
  return (
    input.caseId != null &&
    Number.isInteger(input.caseId) &&
    input.bodySaved &&
    input.stepsComplete &&
    input.pendingCount > 0
  );
}

export function caseAuthoringAttachmentFailureMessage(input: {
  caseCode?: string | null;
  failedNames: string[];
}): string {
  const code = input.caseCode?.trim() || "This case";
  const names = input.failedNames.filter(Boolean);
  if (names.length === 0) {
    return `${code} was saved, but one or more images could not be uploaded. Retry the failed files.`;
  }
  return `${code} was saved, but ${names.join(", ")} could not be uploaded. Retry the failed files.`;
}

/**
 * After a successful body+steps save, keep the case resume and track attachment-only recovery.
 * Successful uploads are not retried.
 */
export function attachmentUploadPlan(files: StagedCaseAttachment[]): {
  toUpload: StagedCaseAttachment[];
  alreadyUploaded: StagedCaseAttachment[];
} {
  return {
    toUpload: pendingStagedCaseAttachments(files),
    alreadyUploaded: files.filter((row) => row.status === "uploaded")
  };
}
