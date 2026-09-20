import type { ResultSaveFeedback, ResultSaveRetryPayload } from "./resultSaveFeedback";

export type ResultDialogClosePrompt = "none" | "discard-unsaved-draft" | "partial-success-leave";

export type ResultDialogCloseDecision = "keep-editing" | "leave-with-recovery" | "discard";

/** Decide whether Cancel/Escape needs a confirmation footer. */
export function resolveResultDialogClosePrompt(input: {
  saving: boolean;
  dirty: boolean;
  partialSuccess: boolean;
}): ResultDialogClosePrompt {
  if (input.saving) return "none";
  if (input.partialSuccess) return "partial-success-leave";
  if (input.dirty) return "discard-unsaved-draft";
  return "none";
}

export function shouldDiscardResultRecovery(decision: ResultDialogCloseDecision): boolean {
  return decision === "discard";
}

export function resultAttachmentReselectMessage(fileNames: string[]): string {
  if (fileNames.length === 1) {
    return `Result saved. Select ${fileNames[0]} again to finish attaching.`;
  }
  if (fileNames.length > 1) {
    return `Result saved. Select ${fileNames.length} files again to finish attaching.`;
  }
  return "Result saved. Select the files again to finish attaching.";
}

export type ParkedPartialRecovery = {
  testId: string;
  createdResultId: string;
  previousStatus: ResultSaveFeedback["previousStatus"];
  message: string;
  kind?: ResultSaveFeedback["kind"];
  pendingAssignment?: string | null;
  awaitingFileReselect: boolean;
  missingFileNames: string[];
  retryPayload: Omit<ResultSaveRetryPayload, "attachments" | "stagedAttachments">;
};

function storageKey(runId: string) {
  return `qa-rail:result-partial-recovery:v1:${runId}`;
}

export function serializeParkedPartialRecovery(feedback: ResultSaveFeedback): ParkedPartialRecovery | null {
  if (feedback.status !== "failed" || !feedback.createdResultId) return null;
  const staged = feedback.retryPayload.stagedAttachments ?? [];
  const namesFromFiles =
    staged.length > 0
      ? staged.map((row) => row.file.name)
      : (feedback.retryPayload.attachments ?? []).map((file) => file.name);
  // Keep previously parked names when File bytes are already gone (re-persist after restore).
  const names = namesFromFiles.length > 0 ? namesFromFiles : feedback.missingFileNames ?? [];
  const {
    attachments: _attachments,
    stagedAttachments: _stagedAttachments,
    ...retryPayload
  } = feedback.retryPayload;
  return {
    testId: feedback.testId,
    createdResultId: feedback.createdResultId,
    previousStatus: feedback.previousStatus,
    // Session storage cannot keep File bytes — reopen must ask for reselection.
    message: names.length > 0 ? resultAttachmentReselectMessage(names) : feedback.message,
    kind: feedback.kind,
    pendingAssignment: feedback.pendingAssignment,
    awaitingFileReselect: names.length > 0 || Boolean(feedback.awaitingFileReselect),
    missingFileNames: names,
    retryPayload
  };
}

/** Persist only metadata (no file bytes). Used across dialog remounts and soft refreshes in the same tab. */
export function writeParkedPartialRecovery(runId: string, feedback: ResultSaveFeedback) {
  if (typeof window === "undefined" || !runId) return;
  const parked = serializeParkedPartialRecovery(feedback);
  if (!parked) return;
  const key = storageKey(runId);
  const current = readAllParkedPartialRecoveries(runId).filter((row) => row.testId !== parked.testId);
  current.push(parked);
  window.sessionStorage.setItem(key, JSON.stringify(current));
}

export function clearParkedPartialRecovery(runId: string, testId: string) {
  if (typeof window === "undefined" || !runId) return;
  const key = storageKey(runId);
  const next = readAllParkedPartialRecoveries(runId).filter((row) => row.testId !== testId);
  if (next.length === 0) window.sessionStorage.removeItem(key);
  else window.sessionStorage.setItem(key, JSON.stringify(next));
}

export function readAllParkedPartialRecoveries(runId: string): ParkedPartialRecovery[] {
  if (typeof window === "undefined" || !runId) return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey(runId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ParkedPartialRecovery[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parkedRecoveryToFeedback(parked: ParkedPartialRecovery): ResultSaveFeedback {
  const message =
    parked.awaitingFileReselect && parked.missingFileNames.length > 0
      ? resultAttachmentReselectMessage(parked.missingFileNames)
      : parked.message;
  return {
    testId: parked.testId,
    status: "failed",
    message,
    previousStatus: parked.previousStatus,
    canUndo: false,
    retryPayload: {
      ...parked.retryPayload,
      stagedAttachments: [],
      attachments: []
    },
    createdResultId: parked.createdResultId,
    pendingAssignment: parked.pendingAssignment,
    awaitingFileReselect: parked.awaitingFileReselect,
    missingFileNames: parked.missingFileNames,
    operationId: `parked-${parked.testId}`,
    kind: parked.kind ?? "attach-only"
  };
}
