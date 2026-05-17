import { defaultCompositionMetadata, type RunCompositionMetadata } from "./runComposition.js";
import type { CreateRunWithInstancesInput, TestRun } from "./runs.types.js";

export type DuplicateRunOptions = {
  name?: string;
  milestoneId?: bigint | null;
  copyAssignee?: boolean;
  copySchedule?: boolean;
  copyEnvironment?: boolean;
};

function bigintIds(ids: string[] | undefined): bigint[] | undefined {
  if (!ids?.length) return undefined;
  return ids.map((id) => BigInt(id));
}

export function buildDuplicateRunCreateInput(
  run: TestRun,
  instanceCaseIds: readonly bigint[],
  options: DuplicateRunOptions = {}
): CreateRunWithInstancesInput {
  const composition: RunCompositionMetadata =
    run.composition ?? defaultCompositionMetadata(run.includeAll);
  const mode = composition.compositionMode;

  let caseIds: bigint[] | undefined;
  if (mode === "static" && !run.includeAll) {
    caseIds = [...instanceCaseIds];
  }

  const copyAssignee = options.copyAssignee !== false;
  const copySchedule = options.copySchedule === true;
  const copyEnvironment = options.copyEnvironment !== false;
  const trimmedName = options.name?.trim();

  return {
    projectId: run.projectId,
    suiteId: run.suiteId,
    milestoneId: options.milestoneId !== undefined ? options.milestoneId : run.milestoneId,
    name: trimmedName && trimmedName.length > 0 ? trimmedName : `${run.name} (copy)`,
    includeAll: run.includeAll,
    compositionMode: mode,
    filterDefinition: composition.filterDefinition,
    excludedCaseIds: bigintIds(composition.excludedCaseIds),
    excludedSectionIds: bigintIds(composition.excludedSectionIds),
    includedSectionIds: bigintIds(composition.includedSectionIds),
    caseIds,
    environment: copyEnvironment ? (run.environment ?? null) : null,
    assignedTo: copyAssignee ? (run.assignedTo ?? null) : null,
    startedAt: copySchedule ? (run.startedAt ?? null) : null,
    dueOn: copySchedule ? (run.dueOn ?? null) : null
  };
}
