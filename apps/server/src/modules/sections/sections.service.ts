import { AppError } from "../../common/errors/appError.js";
import { ProjectsMemoryRepository } from "../projects/projects.memory.repository.js";

export class SectionsService {
  constructor(private readonly repo: ProjectsMemoryRepository) {}

  listSections(suiteId: bigint) {
    return this.repo.listSectionsBySuite(suiteId);
  }
  createSection(input: { suiteId: bigint; parentSectionId?: bigint | null; name: string }) {
    return this.repo.createSection(input);
  }
  updateSection(sectionId: bigint, patch: { parentSectionId?: bigint | null; name?: string }) {
    const updated = this.repo.updateSection(sectionId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);
    return updated;
  }
  deleteSection(sectionId: bigint) {
    const deleted = this.repo.deleteSection(sectionId);
    if (!deleted) throw new AppError("NOT_FOUND", `section ${sectionId.toString()} not found`, 404);
  }
}
