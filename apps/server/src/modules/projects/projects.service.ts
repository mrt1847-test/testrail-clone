import { AppError } from "../../common/errors/appError.js";
import { normalizeProjectType, type ProjectType } from "../../domain/projectTypes.js";
import type { ProjectsRepository } from "./projects.repository.js";

export class ProjectsService {
  constructor(private readonly repo: ProjectsRepository) {}

  async listProjects() {
    return this.repo.listProjects();
  }
  async createProject(input: {
    name: string;
    description?: string;
    projectType?: ProjectType;
    ownerUserId?: bigint;
  }) {
    return this.repo.createProject({
      name: input.name,
      description: input.description ?? null,
      projectType: normalizeProjectType(input.projectType),
      ownerUserId: input.ownerUserId
    });
  }
  async getProject(projectId: bigint) {
    const found = await this.repo.getProject(projectId);
    if (!found) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
    return found;
  }
  async updateProject(
    projectId: bigint,
    patch: { name?: string; description?: string; projectType?: ProjectType }
  ) {
    const updated = await this.repo.updateProject(projectId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
    return updated;
  }
  async setProjectArchived(projectId: bigint, archived: boolean) {
    const updated = await this.repo.updateProject(projectId, { isArchived: archived });
    if (!updated) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
    return updated;
  }
  async deleteProject(projectId: bigint) {
    const deleted = await this.repo.deleteProject(projectId);
    if (!deleted) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
  }
}
