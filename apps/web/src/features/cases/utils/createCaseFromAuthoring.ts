import { createCase } from "../api/catalogApi";
import { extractApiErrorCode, extractApiErrorMessage } from "../caseErrors";
import type { CaseAuthoringSubmitInput } from "../components/CaseAuthoringForm";
import type { TestCase } from "../types";
import {
  authoringFailureKind,
  authoringFailureSummary,
  emptyAuthoringOutcome,
  mergeDraftsForRetry,
  shouldCreateNewCase,
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

export async function createCaseFromAuthoring(
  sectionId: number,
  input: CaseAuthoringSubmitInput,
  resume?: AuthoringPersistResume | null
): Promise<AuthoringPersistOutcome> {
  const drafts = mergeDraftsForRetry(draftsFromSubmit(input), resume);
  let created: TestCase | undefined = resume?.created;
  let bodySaved = Boolean(resume?.bodySaved && resume.caseId != null);

  if (shouldCreateNewCase(resume)) {
    try {
      created = await createCase(sectionId, {
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
        customValues: input.customValues
      });
      bodySaved = true;
    } catch (error) {
      const conflict = extractApiErrorCode(error) === "CONFLICT";
      const failureKind = authoringFailureKind({ bodySaved: false, conflict, failedStepIndex: null });
      const message = authoringFailureSummary({
        failureKind,
        detail: extractApiErrorMessage(error, "Could not create case.")
      });
      return emptyAuthoringOutcome({
        failureKind,
        message,
        stepsWarning: null
      });
    }
  }

  if (!created) {
    return emptyAuthoringOutcome({ message: "Could not create case. Nothing was stored." });
  }

  const existingSteps = (resume?.completedDrafts ?? [])
    .filter((row) => row.id != null)
    .map((row) => ({ id: row.id, description: row.description, expected: row.expected }));
  const sync = await syncCaseInstructionSteps(created.id, existingSteps, drafts);
  const failureKind = sync.ok
    ? null
    : authoringFailureKind({ bodySaved: true, failedStepIndex: sync.failedIndex });
  const message = sync.ok
    ? null
    : authoringFailureSummary({
        failureKind,
        caseCode: created.caseCode,
        failedStepNumber: sync.failedIndex != null ? sync.failedIndex + 1 : null,
        stepCount: drafts.length,
        detail: sync.error ? extractApiErrorMessage(sync.error, "Could not save steps.") : null
      });

  return {
    ok: sync.ok,
    created,
    caseId: created.id,
    caseCode: created.caseCode,
    bodySaved,
    moved: true,
    stepsComplete: sync.ok,
    savedStepIds: sync.savedStepIds,
    completedDrafts: sync.completedDrafts,
    pendingDrafts: sync.pendingDrafts,
    failureKind,
    message,
    stepsWarning: message
  };
}
