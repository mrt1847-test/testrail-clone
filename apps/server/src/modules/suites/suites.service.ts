import { AppError } from "../../common/errors/appError.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";

export class SuitesService {
  constructor(private readonly repo: ProjectsRepository) {}

  async listSuites(projectId: bigint) {
    return this.repo.listSuitesByProject(projectId);
  }
  async createSuite(input: { projectId: bigint; name: string; description?: string }) {
    return this.repo.createSuite(input);
  }
  async getSuite(suiteId: bigint) {
    const found = await this.repo.getSuite(suiteId);
    if (!found) throw new AppError("NOT_FOUND", `suite ${suiteId.toString()} not found`, 404);
    return found;
  }
  async updateSuite(suiteId: bigint, patch: { name?: string; description?: string }) {
    const updated = await this.repo.updateSuite(suiteId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `suite ${suiteId.toString()} not found`, 404);
    return updated;
  }
  async deleteSuite(suiteId: bigint) {
    const deleted = await this.repo.deleteSuite(suiteId);
    if (!deleted) throw new AppError("NOT_FOUND", `suite ${suiteId.toString()} not found`, 404);
  }
}
