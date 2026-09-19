import type { ResultStatus } from "../components/resultEntryTypes";

export type ResultSaveFeedbackStatus = "idle" | "saving" | "saved" | "failed";

export type ResultSaveRetryPayload = {
  status: ResultStatus;
  comment?: string;
  elapsed?: string;
  version?: string;
  defects?: string[];
  customValues?: Record<string, string | number | boolean | string[] | null>;
  stepResults?: Array<{
    stepOrder: number;
    status: ResultStatus;
    actualResult?: string;
    comment?: string;
  }>;
  scenarioResults?: Array<{ caseScenarioId: string; status: ResultStatus; comment?: string }>;
  aiActualOutput?: string;
  aiQualityRating?: number;
  aiLatencyMs?: number;
  aiTraces?: string;
  attachments?: File[];
  stagedAttachments?: Array<{ id: string; file: File }>;
  assignedTo?: string | null;
};

export type ResultSaveAdvanceOptions = {
  advanceOnPass?: boolean;
  advanceToTestId?: string | null;
};

export type ResultSaveOperationKind = "create-result" | "attach-only" | "assign-only";

export type ResultSaveFeedback = {
  testId: string;
  status: ResultSaveFeedbackStatus;
  message: string;
  previousStatus: ResultStatus;
  canUndo: boolean;
  retryPayload: ResultSaveRetryPayload;
  retryAdvance?: ResultSaveAdvanceOptions;
  createdResultId?: string | null;
  pendingAssignment?: string | null;
  operationId: string;
  kind?: ResultSaveOperationKind;
};

export const RESULT_SAVE_UNDO_MS = 8000;
export const RESULT_SAVE_CLEARED_MS = 2500;

export function canUndoResultSave(previousStatus: ResultStatus): boolean {
  return previousStatus !== "untested";
}

export function overlayInstanceStatus<T extends { id: string; status: string }>(
  instances: T[],
  overrides: Record<string, string>
): T[] {
  const keys = Object.keys(overrides);
  if (keys.length === 0) return instances;
  return instances.map((row) => {
    const next = overrides[row.id];
    return next && next !== row.status ? { ...row, status: next } : row;
  });
}

export function resultPartialAttachmentFailureMessage(failedFileNames: string[]): string {
  if (failedFileNames.length === 1) {
    return `Result saved. Couldn't attach ${failedFileNames[0]}.`;
  }
  if (failedFileNames.length > 1) {
    return `Result saved. Couldn't attach ${failedFileNames.length} files.`;
  }
  return "Result saved.";
}

export function resultPartialAssignmentFailureMessage() {
  return "Result saved. Couldn't change assignee.";
}

export function resultPartialAttachmentAndAssignmentFailureMessage(failedFileNames: string[]) {
  return `${resultPartialAttachmentFailureMessage(failedFileNames)} Couldn't change assignee.`;
}

export function attachmentRetryFailureMessage(failedFileNames: string[]) {
  if (failedFileNames.length === 1) return `Couldn't attach ${failedFileNames[0]}`;
  if (failedFileNames.length > 1) return `Couldn't attach ${failedFileNames.length} files`;
  return "Couldn't attach files";
}

export function resultSaveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const trimmed = error.message.trim();
    try {
      const parsed = JSON.parse(trimmed) as {
        message?: string;
        code?: string;
        error?: string | { message?: string; code?: string };
      };
      const nested = typeof parsed.error === "object" ? parsed.error : undefined;
      const code = parsed.code ?? nested?.code;
      if (code === "UNTESTED_NOT_ALLOWED") {
        return "Untested cannot be set after a result exists for this test.";
      }
      if (code === "STORAGE_UNAVAILABLE") {
        return "Couldn't store the file. Attachment storage isn't available.";
      }
      if (nested?.message) return nested.message;
      if (typeof parsed.error === "string" && parsed.error) return parsed.error;
      if (parsed.message) return parsed.message;
    } catch {
      if (trimmed.length <= 140) return trimmed;
    }
  }
  return "Couldn't save result";
}

export function pruneMatchedStatusOverrides<T extends { id: string; status: string }>(
  overrides: Record<string, string>,
  instances: T[]
): Record<string, string> {
  let changed = false;
  const next = { ...overrides };
  for (const row of instances) {
    if (next[row.id] && next[row.id] === row.status) {
      delete next[row.id];
      changed = true;
    }
  }
  return changed ? next : overrides;
}
