import { AppError } from "../../common/errors/appError.js";
import { assertRunCreationInput } from "../../domain/invariants.js";
import type { CreateRunWithInstancesInput } from "./runs.types.js";
import type { RunsRepository } from "./runs.repository.js";

export class RunsService {
  constructor(private readonly repo: RunsRepository) {}

  async createRunWithInstances(input: CreateRunWithInstancesInput) {
    assertRunCreationInput(input.includeAll, input.caseIds);

    return this.repo.transaction(async (tx) => {
      const run = await tx.createRun({
        projectId: input.projectId,
        suiteId: input.suiteId,
        name: input.name,
        includeAll: input.includeAll
      });

      const cases = await tx.getCasesForRun({
        projectId: input.projectId,
        suiteId: input.suiteId,
        caseIds: input.caseIds,
        includeAll: input.includeAll
      });

      if (cases.length === 0) {
        throw new AppError("NO_CASES_FOUND", "no cases found to create run instances");
      }

      const instances = await tx.createInstances(
        cases.map((c) => ({
          runId: run.id,
          caseId: c.id,
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
}
