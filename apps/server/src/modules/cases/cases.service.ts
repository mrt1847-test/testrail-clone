import { AppError } from "../../common/errors/appError.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";

export class CasesService {
  constructor(private readonly repo: ProjectsRepository) {}

  async listCases(params: { projectId?: bigint; suiteId?: bigint; sectionId?: bigint; q?: string }) {
    return this.repo.listCases(params);
  }
  async createCase(input: {
    sectionId: bigint;
    title: string;
    priority?: string;
    caseType?: string;
    preconditions?: string;
  }) {
    return this.repo.createCase(input);
  }
  async getCase(caseId: bigint) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const steps = await this.repo.listCaseSteps(caseId);
    return { ...found, steps };
  }
  async updateCase(caseId: bigint, patch: { title?: string; priority?: string; caseType?: string; preconditions?: string | null }) {
    const updated = await this.repo.updateCase(caseId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    return updated;
  }
  async deleteCase(caseId: bigint) {
    const deleted = await this.repo.deleteCase(caseId);
    if (!deleted) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
  }

  async createCaseStep(caseId: bigint, input: { content: string; expectedResult?: string | null }) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const steps = await this.repo.listCaseSteps(caseId);
    const nextOrder = steps.reduce((m, s) => Math.max(m, s.stepOrder), 0) + 1;
    return this.repo.createCaseStep({
      caseId,
      stepOrder: nextOrder,
      content: input.content,
      expectedResult: input.expectedResult
    });
  }

  async updateCaseStep(
    stepId: bigint,
    patch: { content?: string; expectedResult?: string | null; stepOrder?: number }
  ) {
    const updated = await this.repo.updateCaseStep(stepId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `case step ${stepId.toString()} not found`, 404);
    return updated;
  }

  async deleteCaseStep(stepId: bigint) {
    const deleted = await this.repo.deleteCaseStep(stepId);
    if (!deleted) throw new AppError("NOT_FOUND", `case step ${stepId.toString()} not found`, 404);
  }
}
