import type { CaseAuthoringDraftStep } from "./caseAuthoringInstructions";
import type { TestCase } from "../types";

export type AuthoringFailureKind = "body" | "steps-first" | "steps-middle" | "move" | "conflict";

export type AuthoringPersistResume = {
  caseId: number;
  caseCode: string | null;
  created?: TestCase;
  bodySaved: boolean;
  moved: boolean;
  completedDrafts: CaseAuthoringDraftStep[];
  savedStepIds: number[];
  failureKind: AuthoringFailureKind | null;
};

export type AuthoringPersistOutcome = {
  ok: boolean;
  created?: TestCase;
  caseId: number | null;
  caseCode: string | null;
  bodySaved: boolean;
  moved: boolean;
  stepsComplete: boolean;
  savedStepIds: number[];
  completedDrafts: CaseAuthoringDraftStep[];
  pendingDrafts: CaseAuthoringDraftStep[];
  failureKind: AuthoringFailureKind | null;
  message: string | null;
  stepsWarning: string | null;
};

export class AuthoringPersistError extends Error {
  readonly outcome: AuthoringPersistOutcome;

  constructor(outcome: AuthoringPersistOutcome) {
    super(outcome.message ?? "Could not save case changes.");
    this.name = "AuthoringPersistError";
    this.outcome = outcome;
  }
}

export function isAuthoringPersistError(error: unknown): error is AuthoringPersistError {
  return error instanceof AuthoringPersistError;
}

export function authoringFailureKind(input: {
  conflict?: boolean;
  bodySaved: boolean;
  moveFailed?: boolean;
  failedStepIndex: number | null;
}): AuthoringFailureKind | null {
  if (input.conflict) return "conflict";
  if (!input.bodySaved) return "body";
  if (input.moveFailed) return "move";
  if (input.failedStepIndex == null) return null;
  return input.failedStepIndex === 0 ? "steps-first" : "steps-middle";
}

export function authoringFailureSummary(input: {
  failureKind: AuthoringFailureKind | null;
  caseCode?: string | null;
  failedStepNumber?: number | null;
  stepCount?: number | null;
  detail?: string | null;
}): string {
  const code = input.caseCode?.trim() || "This case";
  const detail = input.detail?.trim();
  switch (input.failureKind) {
    case "body":
      return detail ? `Could not save the test case. ${detail}` : "Could not save the test case. Nothing was stored.";
    case "conflict":
      return "This case changed after you opened it. Refresh, then save again.";
    case "move":
      return `${code} was saved, but it could not be moved to the new section. Retry the move.`;
    case "steps-first":
      return `${code} was saved, but steps could not be saved. Retry the steps.`;
    case "steps-middle": {
      const stepNo = input.failedStepNumber ?? 2;
      const total = input.stepCount != null ? ` of ${input.stepCount}` : "";
      return `${code} was saved. Step ${stepNo}${total} could not be saved. Retry the remaining steps.`;
    }
    default:
      return detail || "Could not save case changes.";
  }
}

export function authoringLeaveDescription(input: {
  mode: "add" | "edit";
  bodySaved: boolean;
  stepsComplete: boolean;
  caseCode?: string | null;
  hasPendingAttachments?: boolean;
}): string {
  if (input.bodySaved && input.hasPendingAttachments) {
    const code = input.caseCode?.trim() || "This case";
    return `${code} is already saved. Staged images that were not uploaded will be lost.`;
  }
  if (input.bodySaved && !input.stepsComplete) {
    const code = input.caseCode?.trim() || "This case";
    return `${code} is already saved. Unsaved steps will be lost.`;
  }
  return input.mode === "edit"
    ? "Your unsaved test case changes will be lost."
    : "Your changes to this new test case will be lost.";
}

export function shouldCreateNewCase(resume: AuthoringPersistResume | null | undefined): boolean {
  return !(resume?.bodySaved && resume.caseId != null);
}

export function mergeDraftsForRetry(
  current: CaseAuthoringDraftStep[],
  resume: AuthoringPersistResume | null | undefined
): CaseAuthoringDraftStep[] {
  if (!resume) return current;
  const byKey = new Map(resume.completedDrafts.filter((row) => row.id != null).map((row) => [row.key, row]));
  return current.map((row, index) => {
    if (row.id != null) return row;
    const fromKey = byKey.get(row.key);
    if (fromKey?.id != null) return { ...row, id: fromKey.id };
    const fromIndex = resume.completedDrafts[index];
    if (fromIndex?.id != null) return { ...row, id: fromIndex.id };
    return row;
  });
}

export function uniqueSavedStepIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id)))];
}

export function resumeFromOutcome(outcome: AuthoringPersistOutcome): AuthoringPersistResume | null {
  if (outcome.caseId == null || !outcome.bodySaved) return null;
  return {
    caseId: outcome.caseId,
    caseCode: outcome.caseCode,
    created: outcome.created,
    bodySaved: outcome.bodySaved,
    moved: outcome.moved,
    completedDrafts: outcome.completedDrafts,
    savedStepIds: uniqueSavedStepIds(outcome.savedStepIds),
    failureKind: outcome.failureKind
  };
}

export function emptyAuthoringOutcome(partial: Partial<AuthoringPersistOutcome> = {}): AuthoringPersistOutcome {
  return {
    ok: false,
    caseId: null,
    caseCode: null,
    bodySaved: false,
    moved: false,
    stepsComplete: false,
    savedStepIds: [],
    completedDrafts: [],
    pendingDrafts: [],
    failureKind: "body",
    message: authoringFailureSummary({ failureKind: "body" }),
    stepsWarning: null,
    ...partial
  };
}
