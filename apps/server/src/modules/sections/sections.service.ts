import { AppError } from "../../common/errors/appError.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";

export class SectionsService {
  constructor(private readonly repo: ProjectsRepository) {}

  async listSections(suiteId: bigint) {
    return this.repo.listSectionsBySuite(suiteId);
  }
  async createSection(input: { suiteId: bigint; parentSectionId?: bigint | null; name: string }) {
    return this.repo.createSection(input);
  }
  async updateSection(sectionId: bigint, patch: { parentSectionId?: bigint | null; name?: string }) {
    const updated = await this.repo.updateSection(sectionId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);
    return updated;
  }
  async deleteSection(sectionId: bigint) {
    const deleted = await this.repo.deleteSection(sectionId);
    if (!deleted) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);
  }
}
