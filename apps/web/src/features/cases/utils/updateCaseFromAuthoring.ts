import { bulkMoveCases, updateCase } from "../api/catalogApi";
import { extractApiErrorCode, extractApiErrorMessage } from "../caseErrors";
import type { CaseAuthoringSubmitInput } from "../components/CaseAuthoringForm";
import type { TestCase } from "../types";
import {
  authoringFailureKind,
  authoringFailureSummary,
  emptyAuthoringOutcome,
  mergeDraftsForRetry,
  type AuthoringPersistOutcome,
  type AuthoringPersistResume
} from "./authoringPersistOutcome";
import { apiCasePriorityValue, apiCaseTypeValue, draftStepsForTextPersist } from "./caseAuthoringInstructions";
import { syncCaseInstructionSteps } from "./syncCaseInstructionSteps";

function draftsFromSubmit(input: CaseAuthoringSubmitInput) {
  if (input.instructionKind === "text") return draftStepsForTextPersist(input.stepsText);
  if (input.instructionKind === "steps") return input.draftSteps;
  return [];
}

export async function updateCaseFromAuthoring(
  projectId: string,
  existing: TestCase,
  sectionId: number,
  input: CaseAuthoringSubmitInput,
  resume?: AuthoringPersistResume | null
): Promise<AuthoringPersistOutcome> {
  const drafts = mergeDraftsForRetry(draftsFromSubmit(input), resume);
  let bodySaved = Boolean(resume?.bodySaved && resume.failureKind !== "conflict");
  let moved = Boolean(resume?.moved) || sectionId === existing.sectionId;

  if (!bodySaved) {
    try {
      await updateCase(existing.id, {
        title: input.title,
        preconditions: input.preconditions,
        estimate: input.estimate.trim().length > 0 ? input.estimate.trim() : null,
        expectedResult: input.expectedResult.trim().length > 0 ? input.expectedResult.trim() : null,
        mission: input.mission.trim().length > 0 ? input.mission.trim() : null,
        goals: input.goals.trim().length > 0 ? input.goals.trim() : null,
        aiInput: input.aiInput.trim().length > 0 ? input.aiInput.trim() : null,
        aiExpectedOutput: input.aiExpectedOutput.trim().length > 0 ? input.aiExpectedOutput.trim() : null,
        caseTemplateId: input.templateId ? Number(input.templateId) : null,
        caseType: apiCaseTypeValue(input.caseType),
        priority: apiCasePriorityValue(input.priority),
        refs: input.references.trim().length > 0 ? input.references.trim() : null,
        customValues: input.customValues,
        expectedVersion: Number.isInteger(existing.lockVersion) ? existing.lockVersion : undefined
      });
      bodySaved = true;
    } catch (error) {
      const conflict = extractApiErrorCode(error) === "CONFLICT";
      const failureKind = authoringFailureKind({ bodySaved: false, conflict, failedStepIndex: null });
      const message = authoringFailureSummary({
        failureKind,
        caseCode: existing.caseCode,
        detail: extractApiErrorMessage(error, "Could not save case changes.")
      });
      return emptyAuthoringOutcome({
        caseId: existing.id,
        caseCode: existing.caseCode,
        failureKind,
        message,
        stepsWarning: null
      });
    }
  }

  if (!moved && sectionId !== existing.sectionId) {
    try {
      await bulkMoveCases(projectId, [existing.id], sectionId);
      moved = true;
    } catch (error) {
      const failureKind = authoringFailureKind({ bodySaved: true, moveFailed: true, failedStepIndex: null });
      const message = authoringFailureSummary({
        failureKind,
        caseCode: existing.caseCode,
        detail: extractApiErrorMessage(error, "Could not move the case.")
      });
      return emptyAuthoringOutcome({
        caseId: existing.id,
        caseCode: existing.caseCode,
        bodySaved: true,
        moved: false,
        failureKind,
        message,
        completedDrafts: resume?.completedDrafts ?? [],
        savedStepIds: resume?.savedStepIds ?? [],
        pendingDrafts: drafts
      });
    }
  }

  const existingSteps = [
    ...existing.steps,
    ...(resume?.completedDrafts ?? [])
      .filter((row) => row.id != null && !existing.steps.some((step) => step.id === row.id))
      .map((row) => ({ id: row.id, description: row.description, expected: row.expected }))
  ];
  const sync = await syncCaseInstructionSteps(existing.id, existingSteps, drafts);
  const failureKind = sync.ok
    ? null
    : authoringFailureKind({ bodySaved: true, failedStepIndex: sync.failedIndex });
  const message = sync.ok
    ? null
    : authoringFailureSummary({
        failureKind,
        caseCode: existing.caseCode,
        failedStepNumber: sync.failedIndex != null ? sync.failedIndex + 1 : null,
        stepCount: drafts.length,
        detail: sync.error ? extractApiErrorMessage(sync.error, "Could not save steps.") : null
      });

  return {
    ok: sync.ok,
    caseId: existing.id,
    caseCode: existing.caseCode,
    bodySaved,
    moved,
    stepsComplete: sync.ok,
    savedStepIds: sync.savedStepIds,
    completedDrafts: sync.completedDrafts,
    pendingDrafts: sync.pendingDrafts,
    failureKind,
    message,
    stepsWarning: message
  };
}
