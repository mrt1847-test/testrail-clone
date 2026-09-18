import type { ResultStatus } from "../components/resultEntryTypes";

export type ComposerStepResult = {
  stepOrder: number;
  status: ResultStatus;
  actualResult?: string;
  comment?: string;
};

export type StagedComposerUploadStatus = "queued" | "uploading" | "uploaded" | "failed";

export type StagedComposerFile = {
  id: string;
  file: File;
  status: StagedComposerUploadStatus;
  message?: string;
  progress?: number;
};

export type StagedComposerUploadPatch = {
  status: StagedComposerUploadStatus;
  message?: string;
  progress?: number;
};

export function createStagedComposerFileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function mergeStagedComposerFiles(current: StagedComposerFile[], incoming: File[]): StagedComposerFile[] {
  const next = [...current];
  for (const file of incoming) {
    const exists = next.some(
      (row) => row.file.name === file.name && row.file.size === file.size && row.file.lastModified === file.lastModified
    );
    if (!exists) next.push({ id: createStagedComposerFileId(), file, status: "queued" });
  }
  return next;
}

export function applyStagedComposerUploadPatch(
  files: StagedComposerFile[],
  id: string,
  patch: StagedComposerUploadPatch
): StagedComposerFile[] {
  return files.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export function pendingStagedComposerFiles(files: StagedComposerFile[]): StagedComposerFile[] {
  return files.filter((row) => row.status === "queued" || row.status === "failed");
}

export function canRemoveStagedComposerFile(status: StagedComposerUploadStatus): boolean {
  return status === "queued" || status === "failed";
}

export function stagedComposerStatusLabel(status: StagedComposerUploadStatus, progress?: number): string {
  if (status === "queued") return "Queued";
  if (status === "uploading") {
    return progress != null && progress > 0 ? `Uploading ${Math.min(100, Math.round(progress))}%` : "Uploading…";
  }
  if (status === "uploaded") return "Attached";
  return "Failed";
}

export function stagedAttachmentsFromPayload(payload: {
  stagedAttachments?: Array<{ id: string; file: File }>;
  attachments?: File[];
}): Array<{ id: string; file: File }> {
  if (payload.stagedAttachments?.length) return payload.stagedAttachments;
  return (payload.attachments ?? []).map((file, index) => ({ id: `attachment-${index}-${file.name}`, file }));
}

/** Put the case-level actual result onto the first step when that step has none. */
export function applyCaseActualResult(stepResults: ComposerStepResult[], actualResult: string): ComposerStepResult[] {
  const trimmed = actualResult.trim();
  if (!trimmed) return stepResults;
  if (stepResults.length === 0) {
    return [{ stepOrder: 1, status: "passed", actualResult: trimmed }];
  }
  const [first, ...rest] = stepResults;
  if (first.actualResult?.trim()) return stepResults;
  return [{ ...first, actualResult: trimmed }, ...rest];
}

export function createdResultId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const row = response as { id?: unknown; data?: { id?: unknown } };
  const id = row.id ?? row.data?.id;
  if (id == null || id === "") return null;
  return String(id);
}

export function isResultAttachmentPresignUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /NOT_FOUND|result not found|"statusCode"\s*:\s*404|\b404\b/i.test(message);
}
