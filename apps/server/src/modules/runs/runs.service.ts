import { AppError } from "../../common/errors/appError.js";
import { assertRunCreationInput } from "../../domain/invariants.js";
import type { CreateRunWithInstancesInput, TestInstance } from "./runs.types.js";
import type { RunsRepository } from "./runs.repository.js";

export class RunsService {
  constructor(private readonly repo: RunsRepository) {}

  async createRunWithInstances(input: CreateRunWithInstancesInput) {
    assertRunCreationInput(input.includeAll, input.caseIds, input.excludedCaseIds, input.excludedSectionIds);

    return this.repo.transaction(async (tx) => {
      const run = await tx.createRun({
        projectId: input.projectId,
        suiteId: input.suiteId,
        milestoneId: input.milestoneId ?? null,
        name: input.name,
        includeAll: input.includeAll,
        environment: input.environment ?? null
      });

      const cases = await tx.getCasesForRun({
        projectId: input.projectId,
        suiteId: input.suiteId,
        caseIds: input.caseIds,
        excludedCaseIds: input.excludedCaseIds,
        includeAll: input.includeAll,
        includedSectionIds: input.includedSectionIds,
        excludedSectionIds: input.excludedSectionIds
      });

      if (cases.length === 0) {
        throw new AppError("NO_CASES_FOUND", "no cases found to create run instances");
      }

      const instances = await tx.createInstances(
        cases.map((c) => ({
          runId: run.id,
          caseId: c.id,
          assignedTo: null,
          titleSnapshot: c.title,
          prioritySnapshot: c.priority,
          typeSnapshot: c.caseType,
          estimateSnapshot: c.estimate,
          automationKeySnapshot: c.automationKey,
          externalIdSnapshot: c.externalId
        }))
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
        throw new AppError("VALIDATION_ERROR", "one or more caseIds are not in the run suite", 400);
      }
      const instances = await tx.createInstances(
        cases.map((c) => ({
          runId,
          caseId: c.id,
          assignedTo: null,
          titleSnapshot: c.title,
          prioritySnapshot: c.priority,
          typeSnapshot: c.caseType,
          estimateSnapshot: c.estimate,
          automationKeySnapshot: c.automationKey,
          externalIdSnapshot: c.externalId
        }))
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

  async updateRun(runId: bigint, input: { name?: string; assignedTo?: bigint | null }) {
    const updated = await this.repo.updateRun(runId, input);
    if (!updated) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`);
    }
    return updated;
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

  async listAssignedToMe(projectId: bigint, userId: bigint) {
    return this.repo.listAssignedTests({ projectId, userId });
  }
}
