import { AppError } from "../../common/errors/appError.js";
import { ProjectsMemoryRepository } from "../projects/projects.memory.repository.js";

export class SuitesService {
  constructor(private readonly repo: ProjectsMemoryRepository) {}

  listSuites(projectId: bigint) {
    return this.repo.listSuitesByProject(projectId);
  }
  createSuite(input: { projectId: bigint; name: string; description?: string }) {
    return this.repo.createSuite(input);
  }
  getSuite(suiteId: bigint) {
    const found = this.repo.getSuite(suiteId);
    if (!found) throw new AppError("NOT_FOUND", `suite ${suiteId.toString()} not found`, 404);
    return found;
  }
  updateSuite(suiteId: bigint, patch: { name?: string; description?: string }) {
    const updated = this.repo.updateSuite(suiteId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `suite ${suiteId.toString()} not found`, 404);
    return updated;
  }
  deleteSuite(suiteId: bigint) {
    const deleted = this.repo.deleteSuite(suiteId);
    if (!deleted) throw new AppError("NOT_FOUND", `suite ${suiteId.toString()} not found`, 404);
  }
}
