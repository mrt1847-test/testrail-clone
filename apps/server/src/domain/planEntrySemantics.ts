import { AppError } from "../common/errors/appError.js";
import { prepareCaseRefsInput } from "./caseRefs.js";

export type PlanEntryCompositionInput = {
  includeAll: boolean;
  includeCaseIds: bigint[];
  excludeCaseIds: bigint[];
};

export function parseStoredCaseIds(value: unknown): bigint[] {
  if (!Array.isArray(value)) return [];
  const out: bigint[] = [];
  for (const item of value) {
    try {
      out.push(BigInt(String(item)));
    } catch {
      throw new AppError("VALIDATION_ERROR", "invalid case id in plan entry selection", 400);
    }
  }
  return [...new Set(out)];
}

export function serializeCaseIds(caseIds: bigint[] | undefined) {
  if (!caseIds || caseIds.length === 0) return null;
  return caseIds.map((id) => id.toString());
}

export function resolvePlanEntryRunComposition(input: PlanEntryCompositionInput) {
  if (!input.includeAll && input.includeCaseIds.length === 0) {
    throw new AppError("VALIDATION_ERROR", "includeCaseIds required when includeAll is false", 400);
  }
  return {
    includeAll: input.includeAll,
    caseIds: input.includeAll ? undefined : input.includeCaseIds,
    excludedCaseIds: input.excludeCaseIds.length > 0 ? input.excludeCaseIds : undefined
  };
}

export function assertPlanEntryIncluded(isIncluded: boolean) {
  if (!isIncluded) {
    throw new AppError("VALIDATION_ERROR", "plan entry is excluded from run generation", 400);
  }
}

export function normalizePlanRefs(value: string | null | undefined) {
  if (value === undefined) return undefined;
  try {
    return prepareCaseRefsInput(value);
  } catch {
    throw new AppError("VALIDATION_ERROR", "invalid refs value", 400);
  }
}

export function mergePlanScheduling<T extends { startDate?: Date | null; dueOn?: Date | null; assignedTo?: bigint | null }>(
  entry: T,
  plan: { startDate?: Date | null; dueOn?: Date | null; assignedTo?: bigint | null }
) {
  return {
    assignedTo: entry.assignedTo ?? plan.assignedTo ?? null,
    startedAt: entry.startDate ?? plan.startDate ?? null,
    dueOn: entry.dueOn ?? plan.dueOn ?? null
  };
}
