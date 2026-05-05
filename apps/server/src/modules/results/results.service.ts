import { AppError } from "../../common/errors/appError.js";
import type { RunsRepository, Tx } from "../runs/runs.repository.js";
import type { BulkAddResultsInput, BulkResultResponse, ResultInput } from "./results.types.js";

export class ResultsService {
  constructor(private readonly repo: RunsRepository) {}

  async addResultToTestInstance(testId: bigint, input: ResultInput) {
    return this.repo.transaction(async (tx) => {
      const instance = await tx.getTestInstanceById(testId);
      if (!instance) {
        throw new AppError("TEST_NOT_FOUND", `test instance ${testId.toString()} not found`);
      }
      await this.assertRunIsWritableTx(tx, instance.runId);
      return this.writeResultTx(tx, instance.id, input);
    });
  }

  async addResultForCaseInRun(runId: bigint, caseId: bigint, input: ResultInput) {
    return this.repo.transaction(async (tx) => {
      await this.assertRunIsWritableTx(tx, runId);
      const instance = await tx.getTestInstanceByCaseInRun(runId, caseId);
      if (!instance) {
        throw new AppError(
          "CASE_NOT_FOUND_IN_RUN",
          `case ${caseId.toString()} not found in run ${runId.toString()}`
        );
      }
      return this.writeResultTx(tx, instance.id, input);
    });
  }

  async bulkAddResults(input: BulkAddResultsInput): Promise<BulkResultResponse> {
    const atomic = input.atomic ?? false;
    if (atomic) {
      return this.repo.transaction(async (tx) => {
        await this.assertRunIsWritableTx(tx, input.runId);
        const items: BulkResultResponse["items"] = [];
        const validationErrors: Array<{ index: number; caseId: bigint; message: string }> = [];
        for (let i = 0; i < input.results.length; i += 1) {
          const resultItem = input.results[i];
          const instance = await tx.getTestInstanceByCaseInRun(input.runId, resultItem.caseId);
          if (!instance) {
            validationErrors.push({
              index: i,
              caseId: resultItem.caseId,
              message: `case ${resultItem.caseId.toString()} not found in run ${input.runId.toString()}`
            });
          }
        }
        if (validationErrors.length > 0) {
          const preview = validationErrors
            .slice(0, 3)
            .map((err) => `#${err.index}(C${err.caseId.toString()}): ${err.message}`)
            .join(" | ");
          throw new AppError(
            "BULK_VALIDATION_FAILED",
            `atomic bulk rejected (${validationErrors.length} issues): ${preview}`,
            400,
            {
              issues: validationErrors.map((err) => ({
                index: err.index,
                caseId: err.caseId.toString(),
                code: "CASE_NOT_FOUND_IN_RUN",
                message: err.message
              }))
            }
          );
        }
        for (let i = 0; i < input.results.length; i += 1) {
          const resultItem = input.results[i];
          const instance = await tx.getTestInstanceByCaseInRun(input.runId, resultItem.caseId);
          if (!instance) continue;
          const created = await this.writeResultTx(tx, instance.id, resultItem);
          items.push({
            index: i,
            caseId: resultItem.caseId,
            status: "saved",
            testId: instance.id,
            resultId: created.id
          });
        }
        return {
          runId: input.runId,
          atomic: true,
          total: input.results.length,
          saved: items.length,
          failed: 0,
          items
        };
      });
    }

    const items: BulkResultResponse["items"] = [];
    let saved = 0;
    for (let i = 0; i < input.results.length; i += 1) {
      const resultItem = input.results[i];
      try {
        const created = await this.addResultForCaseInRun(input.runId, resultItem.caseId, resultItem);
        items.push({
          index: i,
          caseId: resultItem.caseId,
          status: "saved",
          testId: created.testInstanceId,
          resultId: created.id
        });
        saved += 1;
      } catch (e) {
        const err = e as { code?: string; message?: string };
        items.push({
          index: i,
          caseId: resultItem.caseId,
          status: "failed",
          errorCode: err.code ?? "UNKNOWN_ERROR",
          message: err.message ?? "unknown error"
        });
      }
    }

    return {
      runId: input.runId,
      atomic: false,
      total: input.results.length,
      saved,
      failed: input.results.length - saved,
      items
    };
  }

  async listResultsForTestInstance(testId: bigint) {
    const instance = await this.repo.transaction(async (tx) => tx.getTestInstanceById(testId));
    if (!instance) {
      throw new AppError("TEST_NOT_FOUND", `test instance ${testId.toString()} not found`);
    }
    return this.repo.listResultsForTestInstance(testId);
  }

  async listResultsForTestInstancePage(testId: bigint, page: number, pageSize: number) {
    const instance = await this.repo.transaction(async (tx) => tx.getTestInstanceById(testId));
    if (!instance) {
      throw new AppError("TEST_NOT_FOUND", `test instance ${testId.toString()} not found`);
    }
    return this.repo.listResultsForTestInstancePage(testId, page, pageSize);
  }

  async listResultStepsByResultId(resultId: bigint) {
    return this.repo.listResultStepsByResultId(resultId);
  }

  private async writeResultTx(tx: Tx, testInstanceId: bigint, input: ResultInput) {
    const created = await tx.createResult(testInstanceId, input);
    if (input.stepResults && input.stepResults.length > 0) {
      await tx.createResultSteps(created.id, input.stepResults);
    }
    await tx.updateInstanceStatus(testInstanceId, input.status);
    return created;
  }

  private async assertRunIsWritableTx(tx: Tx, runId: bigint) {
    const run = await tx.getRunById(runId);
    if (!run) {
      throw new AppError("RUN_NOT_FOUND", `run ${runId.toString()} not found`, 404);
    }
    if (run.status === "closed") {
      throw new AppError("RUN_CLOSED", `run ${runId.toString()} is closed`, 409);
    }
  }
}
