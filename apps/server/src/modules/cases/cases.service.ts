import { AppError } from "../../common/errors/appError.js";
import { ProjectsMemoryRepository } from "../projects/projects.memory.repository.js";

export class CasesService {
  constructor(private readonly repo: ProjectsMemoryRepository) {}

  listCases(params: { projectId?: bigint; sectionId?: bigint; q?: string }) {
    return this.repo.listCases(params);
  }
  createCase(input: { sectionId: bigint; title: string; priority?: string; caseType?: string }) {
    return this.repo.createCase(input);
  }
  getCase(caseId: bigint) {
    const found = this.repo.getCase(caseId);
    if (!found) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    return found;
  }
  updateCase(caseId: bigint, patch: { title?: string; priority?: string; caseType?: string }) {
    const updated = this.repo.updateCase(caseId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
    return updated;
  }
  deleteCase(caseId: bigint) {
    const deleted = this.repo.deleteCase(caseId);
    if (!deleted) throw new AppError("NOT_FOUND", `case ${caseId.toString()} not found`, 404);
  }
}
