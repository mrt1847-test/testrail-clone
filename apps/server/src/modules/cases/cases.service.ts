import { AppError } from "../../common/errors/appError.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";

export class CasesService {
  constructor(private readonly repo: ProjectsRepository) {}

  async listCases(params: { projectId?: bigint; sectionId?: bigint; q?: string }) {
    return this.repo.listCases(params);
  }
  async createCase(input: { sectionId: bigint; title: string; priority?: string; caseType?: string }) {
    return this.repo.createCase(input);
  }
  async getCase(caseId: bigint) {
    const found = await this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    return found;
  }
  async updateCase(caseId: bigint, patch: { title?: string; priority?: string; caseType?: string }) {
    const updated = await this.repo.updateCase(caseId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    return updated;
  }
  async deleteCase(caseId: bigint) {
    const deleted = await this.repo.deleteCase(caseId);
    if (!deleted) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
  }
}
