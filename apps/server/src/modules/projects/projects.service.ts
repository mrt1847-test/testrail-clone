import { AppError } from "../../common/errors/appError.js";
import { ProjectsMemoryRepository } from "./projects.memory.repository.js";

export class ProjectsService {
  constructor(private readonly repo: ProjectsMemoryRepository) {}

  listProjects() {
    return this.repo.listProjects();
  }
  createProject(input: { name: string; description?: string }) {
    return this.repo.createProject(input);
  }
  getProject(projectId: bigint) {
    const found = this.repo.getProject(projectId);
    if (!found) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
    return found;
  }
  updateProject(projectId: bigint, patch: { name?: string; description?: string }) {
    const updated = this.repo.updateProject(projectId, patch);
    if (!updated) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
    return updated;
  }
  deleteProject(projectId: bigint) {
    const deleted = this.repo.deleteProject(projectId);
    if (!deleted) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
  }
}
