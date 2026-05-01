import { AppError } from "../common/errors/appError.js";
import type { TestCase, TestInstance } from "../modules/runs/runs.types.js";

export function assertRunCreationInput(includeAll: boolean, caseIds?: bigint[], excludedCaseIds?: bigint[]) {
  if (!includeAll && (!caseIds || caseIds.length === 0)) {
    throw new AppError("VALIDATION_ERROR", "caseIds is required when includeAll is false");
  }
  if (includeAll && caseIds && caseIds.length > 0) {
    throw new AppError("VALIDATION_ERROR", "caseIds is not allowed when includeAll is true");
  }
  if (!includeAll && excludedCaseIds && excludedCaseIds.length > 0) {
    throw new AppError("VALIDATION_ERROR", "excludedCaseIds is only allowed when includeAll is true");
  }
}

export function buildSnapshotFromCase(testCase: TestCase): Omit<TestInstance, "id" | "status"> {
  return {
    runId: 0n,
    caseId: testCase.id,
    assignedTo: null,
    titleSnapshot: testCase.title,
    prioritySnapshot: testCase.priority,
    typeSnapshot: testCase.caseType,
    estimateSnapshot: testCase.estimate,
    automationKeySnapshot: testCase.automationKey,
    externalIdSnapshot: testCase.externalId
  };
}
