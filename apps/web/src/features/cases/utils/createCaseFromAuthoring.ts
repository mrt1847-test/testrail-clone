import { createCase, createCaseStep } from "../api/catalogApi";
import { extractApiErrorMessage } from "../caseErrors";
import type { CaseAuthoringSubmitInput } from "../components/CaseAuthoringForm";
import type { TestCase } from "../types";
import { apiCasePriorityValue, apiCaseTypeValue, draftStepsForTextPersist } from "./caseAuthoringInstructions";

async function persistCreateDraftSteps(
  caseId: number,
  drafts: Array<{ description: string; expected: string }>
): Promise<void> {
  for (const row of drafts) {
    const content = row.description.trim();
    const expected = row.expected.trim();
    if (content.length > 0) {
      await createCaseStep(caseId, {
        content,
        expectedResult: expected.length > 0 ? expected : null
      });
    } else if (expected.length > 0) {
      await createCaseStep(caseId, { content: "-", expectedResult: expected });
    }
  }
}

export async function createCaseFromAuthoring(
  sectionId: number,
  input: CaseAuthoringSubmitInput
): Promise<{ created: TestCase; stepsWarning: string | null }> {
  const created = await createCase(sectionId, {
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
  const stepsToPersist =
    input.instructionKind === "text"
      ? draftStepsForTextPersist(input.stepsText).map(({ description, expected }) => ({ description, expected }))
      : input.instructionKind === "steps"
        ? input.draftSteps.map(({ description, expected }) => ({ description, expected }))
        : [];
  let stepsWarning: string | null = null;
  try {
    await persistCreateDraftSteps(created.id, stepsToPersist);
  } catch (error) {
    stepsWarning = extractApiErrorMessage(error, "Could not save steps.");
  }
  return { created, stepsWarning };
}
