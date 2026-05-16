import { AppError } from "../../common/errors/appError.js";
import {
  canCreateSuite,
  normalizeProjectType,
  shouldTreatAsMasterSuite,
  type ProjectType
} from "../../domain/projectTypes.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";

export class SuitesService {
  constructor(private readonly repo: ProjectsRepository) {}

  async listSuites(projectId: bigint) {
    return this.repo.listSuitesByProject(projectId);
  }

  private async projectTypeFor(projectId: bigint): Promise<ProjectType> {
    const project = await this.repo.getProject(projectId);
    if (!project) throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
    return normalizeProjectType(project.projectType);
  }

  async createSuite(input: {
    projectId: bigint;
    name: string;
    description?: string;
    isBaseline?: boolean;
  }) {
    const projectType = await this.projectTypeFor(input.projectId);
    const existing = await this.repo.listSuitesByProject(input.projectId);
    const policy = canCreateSuite(
      projectType,
      existing.map((row) => ({ isMaster: row.isMaster, isBaseline: row.isBaseline })),
      { isBaseline: input.isBaseline }
    );
    if (!policy.ok) {
      throw new AppError(policy.code, policy.message, 409);
    }

    const isBaseline = Boolean(input.isBaseline);
    const master = existing.find((row) => row.isMaster);
    const created = await this.repo.createSuite({
      projectId: input.projectId,
      name: input.name,
      description: input.description ?? null,
      isMaster: shouldTreatAsMasterSuite(
        projectType,
        existing.map((row) => ({ isMaster: row.isMaster, isBaseline: row.isBaseline }))
      ),
      isBaseline,
      parentSuiteId: isBaseline && master ? master.id : null
    });

    if (isBaseline && master) {
      await this.copySectionTree(master.id, created.id);
    }

    return created;
  }

  async createBaselineSuite(projectId: bigint, name: string) {
    const projectType = await this.projectTypeFor(projectId);
    if (projectType !== "single_repo_baselines") {
      throw new AppError(
        "PROJECT_TYPE_MISMATCH",
        "Baselines are only supported on single-repository-with-baselines projects",
        409
      );
    }
    return this.createSuite({ projectId, name, isBaseline: true });
  }

  private async copySectionTree(sourceSuiteId: bigint, targetSuiteId: bigint) {
    const sections = await this.repo.listSectionsBySuite(sourceSuiteId);
    const idMap = new Map<bigint, bigint>();
    const sorted = [...sections].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || Number(a.id - b.id));

    for (const section of sorted) {
      const parentSectionId =
        section.parentSectionId != null ? (idMap.get(section.parentSectionId) ?? null) : null;
      const created = await this.repo.createSection({
        suiteId: targetSuiteId,
        parentSectionId,
        name: section.name,
        displayOrder: section.displayOrder
      });
      idMap.set(section.id, created.id);
    }
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
    const suite = await this.getSuite(suiteId);
    const projectType = await this.projectTypeFor(suite.projectId);
    const suites = await this.repo.listSuitesByProject(suite.projectId);
    if (projectType === "single_repo" && suites.length <= 1) {
      throw new AppError("PROJECT_SUITE_LIMIT", "Single-repository projects must keep their suite.", 409);
    }
    if (suite.isMaster && suites.some((row) => row.isBaseline && row.id !== suiteId)) {
      throw new AppError("MASTER_SUITE_PROTECTED", "Remove baseline suites before deleting the master suite.", 409);
    }
    const deleted = await this.repo.deleteSuite(suiteId);
    if (!deleted) throw new AppError("NOT_FOUND", `suite ${suiteId.toString()} not found`, 404);
  }
}
