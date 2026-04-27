import { AppError } from "../../common/errors/appError.js";
import type { ProjectsRepository } from "./projects.repository.js";

export class ProjectsService {
  constructor(private readonly repo: ProjectsRepository) {}

  async listProjects() {
    return this.repo.listProjects();
  }
  async createProject(input: { name: string; description?: string; ownerUserId?: bigint }) {
    return this.repo.createProject(input);
  }
  async getProject(projectId: bigint) {
    const found = await this.repo.getProject(projectId);
    if (!found) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
    return found;
  }
  async updateProject(projectId: bigint, patch: { name?: string; description?: string }) {
    const updated = await this.repo.updateProject(projectId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
    return updated;
  }
  async deleteProject(projectId: bigint) {
    const deleted = await this.repo.deleteProject(projectId);
    if (!deleted) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
  }
}
