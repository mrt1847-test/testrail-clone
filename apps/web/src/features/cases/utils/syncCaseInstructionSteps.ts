import { createCaseStep, deleteCaseStep, updateCaseStep } from "../api/catalogApi";
import type { CaseStep } from "../types";
import type { CaseAuthoringDraftStep } from "./caseAuthoringInstructions";

export async function syncCaseInstructionSteps(
  caseId: number,
  existing: CaseStep[],
  drafts: CaseAuthoringDraftStep[]
): Promise<void> {
  const next = drafts.filter((row) => row.description.trim().length > 0 || row.expected.trim().length > 0);
  const keepIds = new Set(next.map((row) => row.id).filter((id): id is number => id != null));
  for (const step of existing) {
    if (step.id != null && !keepIds.has(step.id)) {
      await deleteCaseStep(step.id);
    }
  }

  let order = 1;
  for (const row of next) {
    const content = row.description.trim() || "-";
    const expectedResult = row.expected.trim().length > 0 ? row.expected.trim() : null;
    if (row.id != null) {
      await updateCaseStep(row.id, { content, expectedResult, stepOrder: order });
    } else {
      await createCaseStep(caseId, { content, expectedResult });
    }
    order += 1;
  }
}
