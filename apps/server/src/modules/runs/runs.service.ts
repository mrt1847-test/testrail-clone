import { AppError } from "../../common/errors/appError.js";
import { assertRunCreationInput, buildSnapshotFromCase } from "../../domain/invariants.js";
import { assertExplicitCaseIdsBelongToRunSuite } from "../../domain/runSuitePolicy.js";
import {
  compositionNeedsLiveSync,
  defaultCompositionMetadata,
  toMetadataJson,
  type RunCaseFilterDefinition,
  type RunCompositionMetadata
} from "./runComposition.js";
import type { FilterSelectionMode } from "./runFilterSelection.js";
import { applyExcludedSelectionMode, applyIdSelectionMode } from "./runFilterSelection.js";
import type { CreateRunWithInstancesInput, TestInstance } from "./runs.types.js";
import type { RunsRepository } from "./runs.repository.js";

export class RunsService {
  private compositionSync?: import("./runCompositionSync.service.js").RunCompositionSyncService;

  constructor(private readonly repo: RunsRepository) {}

  bindCompositionSync(sync: import("./runCompositionSync.service.js").RunCompositionSyncService) {
    this.compositionSync = sync;
  }

  async createRunWithInstances(input: CreateRunWithInstancesInput) {
    const compositionMode = input.compositionMode ?? "static";
    assertRunCreationInput(
      input.includeAll,
      input.caseIds,
      input.excludedCaseIds,
      input.excludedSectionIds,
      compositionMode
    );

    const includeAll = compositionMode === "include_all_live" ? true : input.includeAll;
    const metadata: RunCompositionMetadata = {
      ...defaultCompositionMetadata(includeAll, compositionMode),
      ...(input.filterDefinition ? { filterDefinition: input.filterDefinition } : {}),
      ...(input.excludedCaseIds?.length
        ? { excludedCaseIds: input.excludedCaseIds.map((id) => id.toString()) }
        : {}),
      ...(input.excludedSectionIds?.length
        ? { excludedSectionIds: input.excludedSectionIds.map((id) => id.toString()) }
        : {}),
      ...(input.includedSectionIds?.length
        ? { includedSectionIds: input.includedSectionIds.map((id) => id.toString()) }
        : {})
    };

    return this.repo.transaction(async (tx) => {
      const run = await tx.createRun({
        projectId: input.projectId,
        suiteId: input.suiteId,
        milestoneId: input.milestoneId ?? null,
        name: input.name,
        includeAll,
        environment: input.environment ?? null,
        assignedTo: input.assignedTo ?? null,
        startedAt: input.startedAt ?? null,
        dueOn: input.dueOn ?? null,
        metadata: toMetadataJson(metadata)
      });

      const cases = await tx.getCasesForRun({
        projectId: input.projectId,
        suiteId: input.suiteId,
        caseIds: compositionMode === "dynamic_filter" ? undefined : input.caseIds,
        excludedCaseIds: input.excludedCaseIds,
        includeAll,
        includedSectionIds: input.includedSectionIds,
        excludedSectionIds: input.excludedSectionIds,
        compositionMode,
        filterDefinition: input.filterDefinition
      });

      if (compositionMode === "static" && !includeAll && input.caseIds?.length) {
        assertExplicitCaseIdsBelongToRunSuite(input.caseIds, cases, input.suiteId);
      }

      if (cases.length === 0) {
        throw new AppError("NO_CASES_FOUND", "no cases found to create run instances");
      }

      const instances = await tx.createInstances(
        cases.map((c) => {
          const snap = buildSnapshotFromCase(c);
          return { ...snap, runId: run.id };
        })
      );

      return { run, instances };
    });
  }

  async closeRun(runId: bigint) {
    const closed = await this.repo.closeRun(runId);
    if (!closed) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`);
    }
    return closed;
  }

  async reopenRun(runId: bigint) {
    const run = await this.repo.getRun(runId);
    if (!run) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`);
    }
    if (run.status !== "closed") {
      throw new AppError("RUN_NOT_CLOSED", `run ${runId.toString()} is not closed`, 409);
    }
    const reopened = await this.repo.reopenRun(runId);
    if (!reopened) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`);
    }
    return reopened;
  }

  async addCasesToOpenRun(runId: bigint, caseIds: bigint[]) {
    const unique = [...new Set(caseIds)];
    if (unique.length === 0) {
      throw new AppError("VALIDATION_ERROR", "caseIds is required", 400);
    }
    return this.repo.transaction(async (tx) => {
      const run = await tx.getRunById(runId);
      if (!run) {
        throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`, 404);
      }
      if (run.status === "closed") {
        throw new AppError("RUN_CLOSED", `run ${runId.toString()} is closed`, 409);
      }
      const toAdd: bigint[] = [];
      for (const cid of unique) {
        const existing = await tx.getTestInstanceByCaseInRun(runId, cid);
        if (!existing) toAdd.push(cid);
      }
      if (toAdd.length === 0) {
        return { run, added: [] as TestInstance[], skipped: unique.length };
      }
      const cases = await tx.getCasesForRun({
        projectId: run.projectId,
        suiteId: run.suiteId,
        includeAll: false,
        caseIds: toAdd
      });
      if (cases.length !== toAdd.length) {
        throw new AppError(
          "RUN_SUITE_CASE_MISMATCH",
          "A test run may only include cases from one suite. One or more caseIds belong to a different suite than the run.",
          409,
          { suiteId: run.suiteId.toString(), invalidCaseIds: toAdd.filter((id) => !cases.some((row) => row.id === id)).map((id) => id.toString()) }
        );
      }
      const instances = await tx.createInstances(
        cases.map((c) => {
          const snap = buildSnapshotFromCase(c);
          return { ...snap, runId };
        })
      );
      return { run, added: instances, skipped: unique.length - toAdd.length };
    });
  }

  async removeTestFromOpenRun(runId: bigint, testId: bigint, confirmDataLoss?: boolean) {
    return this.repo.transaction(async (tx) => {
      const inst = await tx.getTestInstanceById(testId);
      if (!inst || inst.runId !== runId) {
        throw new AppError("TEST_NOT_FOUND", `test ${testId.toString()} not found in this run`, 404);
      }
      const run = await tx.getRunById(runId);
      if (!run) {
        throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`, 404);
      }
      if (run.status === "closed") {
        throw new AppError("RUN_CLOSED", `run ${runId.toString()} is closed`, 409);
      }
      const n = await tx.countResultsForTestInstance(testId);
      if (n > 0 && !confirmDataLoss) {
        throw new AppError(
          "TEST_HAS_RESULTS",
          "test has result history; resend with confirmDataLoss=true to remove (results will be deleted)",
          409
        );
      }
      await tx.hardDeleteTestInstance(testId);
      return { removed: true as const, hadResults: n > 0, caseId: inst.caseId, titleSnapshot: inst.titleSnapshot };
    });
  }

  async updateRun(
    runId: bigint,
    input: { name?: string; assignedTo?: bigint | null; startedAt?: Date | null; dueOn?: Date | null; closedAt?: Date | null }
  ) {
    const existing = await this.repo.getRun(runId);
    if (!existing) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`, 404);
    }
    if (existing.status === "open" && input.closedAt !== undefined) {
      throw new AppError(
        "VALIDATION_ERROR",
        "use POST /api/runs/:runId/close to close a run; set dueOn for the planned end date",
        400
      );
    }
    const updated = await this.repo.updateRun(runId, input);
    if (!updated) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`);
    }
    return updated;
  }

  async updateRunComposition(
    runId: bigint,
    input: {
      filterDefinition?: RunCaseFilterDefinition;
      filterSelectionMode?: FilterSelectionMode;
      excludedCaseIds?: bigint[];
      includedSectionIds?: bigint[];
      excludedSectionIds?: bigint[];
      sync?: boolean;
    }
  ) {
    const run = await this.repo.getRun(runId);
    if (!run) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`, 404);
    }
    if (run.status === "closed") {
      throw new AppError("RUN_CLOSED", "cannot update composition on a closed run", 409);
    }

    const current = run.composition ?? defaultCompositionMetadata(run.includeAll);
    const next: RunCompositionMetadata = { ...current };

    if (input.filterDefinition !== undefined) {
      next.filterDefinition = input.filterDefinition;
    }
    if (input.includedSectionIds !== undefined) {
      next.includedSectionIds = input.includedSectionIds.map((id) => id.toString());
    }
    if (input.excludedSectionIds !== undefined) {
      next.excludedSectionIds = input.excludedSectionIds.map((id) => id.toString());
    }

    const mode = input.filterSelectionMode;
    const filter = input.filterDefinition ?? next.filterDefinition;
    if (mode && filter) {
      const matching = await this.repo.resolveFilterCaseIds({
        projectId: run.projectId,
        suiteId: run.suiteId,
        includeAll: false,
        filterDefinition: filter,
        includedSectionIds: input.includedSectionIds ?? (next.includedSectionIds ?? []).map((id) => BigInt(id)),
        excludedSectionIds: input.excludedSectionIds ?? (next.excludedSectionIds ?? []).map((id) => BigInt(id))
      });
      const matchingIds = matching.map((id) => id.toString());

      if (current.compositionMode === "static" && !run.includeAll) {
        const instances = await this.repo.listInstancesForRun(runId);
        const currentCaseIds = instances.map((row) => row.caseId.toString());
        const selected = applyIdSelectionMode(mode, currentCaseIds, matchingIds);
        const selectedSet = new Set(selected);
        const toAdd = selected.filter((id) => !currentCaseIds.includes(id)).map((id) => BigInt(id));
        if (toAdd.length > 0) {
          await this.addCasesToOpenRun(runId, toAdd);
        }
        for (const inst of instances) {
          if (selectedSet.has(inst.caseId.toString())) continue;
          const resultCount = await this.repo.listResultsForTestInstance(inst.id);
          if (resultCount.length > 0) continue;
          await this.removeTestFromOpenRun(runId, inst.id, true);
        }
      } else {
        const allCaseIds = (await this.repo.listSuiteCaseIds(run.projectId, run.suiteId)).map((id) => id.toString());
        const currentExcluded = (next.excludedCaseIds ?? []).map(String);
        const directExcluded = input.excludedCaseIds?.map((id) => id.toString());
        const baseExcluded = directExcluded ?? currentExcluded;
        next.excludedCaseIds = applyExcludedSelectionMode(mode, allCaseIds, baseExcluded, matchingIds);
      }
    } else if (input.excludedCaseIds !== undefined) {
      next.excludedCaseIds = input.excludedCaseIds.map((id) => id.toString());
    }

    const updated = await this.repo.updateRunComposition(runId, next);
    if (!updated) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`, 404);
    }

    if (input.sync !== false && compositionNeedsLiveSync(next)) {
      return { run: updated, sync: await this.syncRunComposition(runId) };
    }
    return { run: updated, sync: null };
  }

  async rerunByStatuses(runId: bigint, statuses: Array<"passed" | "failed" | "blocked" | "retest" | "untested">) {
    const run = await this.repo.getRun(runId);
    if (!run) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`);
    }
    const instances = await this.repo.listInstancesForRun(runId);
    const caseIds = instances.filter((instance) => statuses.includes(instance.status)).map((instance) => instance.caseId);
    if (caseIds.length === 0) {
      throw new AppError("NO_CASES_FOUND", "no matching test instances for rerun");
    }
    return this.createRunWithInstances({
      projectId: run.projectId,
      suiteId: run.suiteId,
      name: `${run.name} (rerun)`,
      includeAll: false,
      caseIds
    });
  }

  async updateTestAssignee(testId: bigint, assignedTo: bigint | null) {
    const updated = await this.repo.updateTestAssignee(testId, assignedTo);
    if (!updated) {
      throw new AppError("TEST_NOT_FOUND", `test ${testId.toString()} not found`);
    }
    return updated;
  }

  async listAssignedToMe(
    projectId: bigint,
    userId: bigint,
    filters: import("./assignmentListFilters.js").AssignmentListFilters = {}
  ) {
    return this.repo.listAssignedTests({ projectId, userId, ...filters });
  }

  async listTeamTodo(
    projectId: bigint,
    filters: import("./assignmentListFilters.js").AssignmentListFilters & {
      assigneeId?: bigint | "all";
    }
  ) {
    return this.repo.listTeamTodoTests({ projectId, ...filters });
  }

  async syncRunComposition(runId: bigint) {
    const sync = this.compositionSync;
    if (!sync) {
      throw new AppError("NOT_IMPLEMENTED", "run composition sync requires prisma mode", 501);
    }
    return sync.syncRun(runId);
  }
}
