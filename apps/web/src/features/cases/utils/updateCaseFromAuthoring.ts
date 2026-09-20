import { bulkMoveCases, updateCase } from "../api/catalogApi";
import { extractApiErrorMessage } from "../caseErrors";
import type { CaseAuthoringSubmitInput } from "../components/CaseAuthoringForm";
import type { TestCase } from "../types";
import { apiCasePriorityValue, apiCaseTypeValue, draftStepsForTextPersist } from "./caseAuthoringInstructions";
import { syncCaseInstructionSteps } from "./syncCaseInstructionSteps";

export async function updateCaseFromAuthoring(
  projectId: string,
  existing: TestCase,
  sectionId: number,
  input: CaseAuthoringSubmitInput
): Promise<{ stepsWarning: string | null }> {
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

  if (sectionId !== existing.sectionId) {
    await bulkMoveCases(projectId, [existing.id], sectionId);
  }

  const drafts =
    input.instructionKind === "text"
      ? draftStepsForTextPersist(input.stepsText)
      : input.instructionKind === "steps"
        ? input.draftSteps
        : [];

  let stepsWarning: string | null = null;
  try {
    await syncCaseInstructionSteps(existing.id, existing.steps, drafts);
  } catch (error) {
    stepsWarning = extractApiErrorMessage(error, "Could not save steps.");
  }

  return { stepsWarning };
}
