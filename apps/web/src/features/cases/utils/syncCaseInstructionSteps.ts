import { createCaseStep, deleteCaseStep, updateCaseStep } from "../api/catalogApi";
import { extractApiErrorCode } from "../caseErrors";
import type { CaseStep } from "../types";
import type { CaseAuthoringDraftStep } from "./caseAuthoringInstructions";

export type CaseStepSyncResult = {
  ok: boolean;
  savedStepIds: number[];
  completedDrafts: CaseAuthoringDraftStep[];
  pendingDrafts: CaseAuthoringDraftStep[];
  failedIndex: number | null;
  error: unknown | null;
};

function asContent(row: CaseAuthoringDraftStep) {
  return row.description.trim() || "-";
}

function asExpected(row: CaseAuthoringDraftStep) {
  return row.expected.trim().length > 0 ? row.expected.trim() : null;
}

export async function syncCaseInstructionSteps(
  caseId: number,
  existing: CaseStep[],
  drafts: CaseAuthoringDraftStep[]
): Promise<CaseStepSyncResult> {
  const next = drafts.filter((row) => row.description.trim().length > 0 || row.expected.trim().length > 0);
  const completedDrafts: CaseAuthoringDraftStep[] = [];
  const savedStepIds: number[] = [];

  for (let index = 0; index < next.length; index += 1) {
    const row = next[index]!;
    const content = asContent(row);
    const expectedResult = asExpected(row);
    try {
      if (row.id != null) {
        await updateCaseStep(row.id, { content, expectedResult, stepOrder: index + 1 });
        completedDrafts.push({ ...row, id: row.id });
        savedStepIds.push(row.id);
      } else {
        const id = await createCaseStep(caseId, { content, expectedResult });
        completedDrafts.push({ ...row, id });
        savedStepIds.push(id);
      }
    } catch (error) {
      return {
        ok: false,
        savedStepIds,
        completedDrafts,
        pendingDrafts: next.slice(index),
        failedIndex: index,
        error
      };
    }
  }

  const keepIds = new Set(savedStepIds);
  for (const step of existing) {
    if (step.id == null || keepIds.has(step.id)) continue;
    try {
      await deleteCaseStep(step.id);
    } catch (error) {
      if (extractApiErrorCode(error) === "NOT_FOUND") continue;
      return {
        ok: false,
        savedStepIds,
        completedDrafts,
        pendingDrafts: [],
        failedIndex: Math.max(0, next.length - 1),
        error
      };
    }
  }

  return {
    ok: true,
    savedStepIds,
    completedDrafts,
    pendingDrafts: [],
    failedIndex: null,
    error: null
  };
}
