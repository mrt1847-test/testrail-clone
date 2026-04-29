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
    customValues?: Record<string, string | number | boolean | null>;
  }) {
    const created = await this.repo.createCase(input);
    await this.repo.createCaseVersionSnapshot(created.id, "case_created");
    return created;
  }
  async getCase(caseId: bigint) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    const steps = await this.repo.listCaseSteps(caseId);
    return { ...found, steps };
  }
  async listCaseVersions(caseId: bigint) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    return this.repo.listCaseVersions(caseId);
  }
  async updateCase(
    caseId: bigint,
    patch: {
      title?: string;
      priority?: string;
      caseType?: string;
      preconditions?: string | null;
      customValues?: Record<string, string | number | boolean | null>;
      expectedUpdatedAt?: string;
      expectedVersion?: number;
    }
  ) {
    const { expectedUpdatedAt: _legacy, expectedVersion, ...nextPatch } = patch;
    const updated = await this.repo.updateCase(caseId, nextPatch, expectedVersion);
    if (updated === "conflict") {
      throw new AppError("CONFLICT", "case has been modified by another user", 409);
    }
    if (!updated) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    await this.repo.createCaseVersionSnapshot(caseId, "case_updated");
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
    const created = await this.repo.createCaseStep({
      caseId,
      stepOrder: nextOrder,
      content: input.content,
      expectedResult: input.expectedResult
    });
    await this.repo.createCaseVersionSnapshot(caseId, "case_step_created");
    return created;
  }

  async updateCaseStep(
    stepId: bigint,
    patch: { content?: string; expectedResult?: string | null; stepOrder?: number }
  ) {
    const allCases = await this.repo.listCases({});
    let parentCaseId: bigint | null = null;
    for (const c of allCases) {
      const steps = await this.repo.listCaseSteps(c.id);
      if (steps.some((s) => s.id === stepId)) {
        parentCaseId = c.id;
        break;
      }
    }
    const updated = await this.repo.updateCaseStep(stepId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `case step ${stepId.toString()} not found`, 404);
    if (parentCaseId) {
      await this.repo.createCaseVersionSnapshot(parentCaseId, "case_step_updated");
    }
    return updated;
  }

  async deleteCaseStep(stepId: bigint) {
    const allCases = await this.repo.listCases({});
    let parentCaseId: bigint | null = null;
    for (const c of allCases) {
      const steps = await this.repo.listCaseSteps(c.id);
      if (steps.some((s) => s.id === stepId)) {
        parentCaseId = c.id;
        break;
      }
    }
    const deleted = await this.repo.deleteCaseStep(stepId);
    if (!deleted) throw new AppError("NOT_FOUND", `case step ${stepId.toString()} not found`, 404);
    if (parentCaseId) {
      await this.repo.createCaseVersionSnapshot(parentCaseId, "case_step_deleted");
    }
  }
}
