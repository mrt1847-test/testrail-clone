import { AppError } from "../common/errors/appError.js";
import type { CompositionMode } from "../modules/runs/runComposition.js";
import type { TestCase, TestInstance } from "../modules/runs/runs.types.js";

export function assertRunCreationInput(
  includeAll: boolean,
  caseIds?: bigint[],
  excludedCaseIds?: bigint[],
  excludedSectionIds?: bigint[],
  compositionMode: CompositionMode = "static"
) {
  if (compositionMode === "include_all_live") {
    if (!includeAll) {
      throw new AppError("VALIDATION_ERROR", "includeAll must be true for include_all_live composition", 400);
    }
    if (caseIds && caseIds.length > 0) {
      throw new AppError("VALIDATION_ERROR", "caseIds is not allowed for include_all_live composition", 400);
    }
    return;
  }
  if (compositionMode === "dynamic_filter") {
    if (caseIds && caseIds.length > 0) {
      throw new AppError("VALIDATION_ERROR", "caseIds is not allowed for dynamic_filter composition; cases are derived from the filter", 400);
    }
    if (includeAll) {
      throw new AppError("VALIDATION_ERROR", "includeAll must be false for dynamic_filter composition", 400);
    }
    return;
  }
  if (!includeAll && (!caseIds || caseIds.length === 0)) {
    throw new AppError("VALIDATION_ERROR", "caseIds is required when includeAll is false");
  }
  if (includeAll && caseIds && caseIds.length > 0) {
    throw new AppError("VALIDATION_ERROR", "caseIds is not allowed when includeAll is true");
  }
  if (!includeAll && excludedCaseIds && excludedCaseIds.length > 0) {
    throw new AppError("VALIDATION_ERROR", "excludedCaseIds is only allowed when includeAll is true");
  }
  if (!includeAll && excludedSectionIds && excludedSectionIds.length > 0) {
    throw new AppError("VALIDATION_ERROR", "excludedSectionIds is only allowed when includeAll is true");
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
    externalIdSnapshot: testCase.externalId,
    caseLockVersionAtRun: testCase.lockVersion ?? 1
  };
}
