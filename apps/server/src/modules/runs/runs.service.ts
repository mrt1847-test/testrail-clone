import { AppError } from "../../common/errors/appError.js";
import { assertRunCreationInput } from "../../domain/invariants.js";
import type { CreateRunWithInstancesInput } from "./runs.types.js";
import type { RunsRepository } from "./runs.repository.js";

export class RunsService {
  constructor(private readonly repo: RunsRepository) {}

  async createRunWithInstances(input: CreateRunWithInstancesInput) {
    assertRunCreationInput(input.includeAll, input.caseIds, input.excludedCaseIds);

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
        includeAll: input.includeAll
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
