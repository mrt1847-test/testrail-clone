import type { PrismaClient, Prisma } from "@prisma/client";

import type { CaseRow, ProjectRow, ProjectsRepository, SectionRow, SuiteRow } from "./projects.repository.js";

export class ProjectsPrismaRepository implements ProjectsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listProjects(): Promise<ProjectRow[]> {
    return this.prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { id: "desc" },
      select: { id: true, name: true, description: true }
    });
  }

  async createProject(input: Omit<ProjectRow, "id"> & { ownerUserId?: bigint }): Promise<ProjectRow> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.project.create({
        data: {
          name: input.name,
          description: input.description,
          ...(input.ownerUserId !== undefined
            ? { createdBy: input.ownerUserId, updatedBy: input.ownerUserId }
            : {})
        },
        select: { id: true, name: true, description: true }
      });
      if (input.ownerUserId !== undefined) {
        await tx.projectMember.create({
          data: {
            projectId: created.id,
            userId: input.ownerUserId,
            role: "owner",
            createdBy: input.ownerUserId,
            updatedBy: input.ownerUserId
          }
        });
      }
      return created;
    });
  }

  async getProject(projectId: bigint): Promise<ProjectRow | null> {
    return this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, name: true, description: true }
    });
  }

  async updateProject(
    projectId: bigint,
    patch: Partial<Omit<ProjectRow, "id">>
  ): Promise<ProjectRow | null> {
    const found = await this.getProject(projectId);
    if (!found) return null;
    return this.prisma.project.update({
      where: { id: projectId },
      data: { ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.description !== undefined ? { description: patch.description } : {}) },
      select: { id: true, name: true, description: true }
    });
  }

  async deleteProject(projectId: bigint): Promise<boolean> {
    const found = await this.getProject(projectId);
    if (!found) return false;
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() }
    });
    return true;
  }

  async listSuitesByProject(projectId: bigint): Promise<SuiteRow[]> {
    return this.prisma.testSuite.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, projectId: true, name: true, description: true }
    });
  }

  async createSuite(input: Omit<SuiteRow, "id">): Promise<SuiteRow> {
    return this.prisma.testSuite.create({
      data: { projectId: input.projectId, name: input.name, description: input.description },
      select: { id: true, projectId: true, name: true, description: true }
    });
  }

  async getSuite(suiteId: bigint): Promise<SuiteRow | null> {
    return this.prisma.testSuite.findFirst({
      where: { id: suiteId, deletedAt: null },
      select: { id: true, projectId: true, name: true, description: true }
    });
  }

  async updateSuite(
    suiteId: bigint,
    patch: Partial<Omit<SuiteRow, "id" | "projectId">>
  ): Promise<SuiteRow | null> {
    const found = await this.getSuite(suiteId);
    if (!found) return null;
    return this.prisma.testSuite.update({
      where: { id: suiteId },
      data: { ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.description !== undefined ? { description: patch.description } : {}) },
      select: { id: true, projectId: true, name: true, description: true }
    });
  }

  async deleteSuite(suiteId: bigint): Promise<boolean> {
    const found = await this.getSuite(suiteId);
    if (!found) return false;
    await this.prisma.testSuite.update({
      where: { id: suiteId },
      data: { deletedAt: new Date() }
    });
    return true;
  }

  async listSectionsBySuite(suiteId: bigint): Promise<SectionRow[]> {
    return this.prisma.section.findMany({
      where: { suiteId, deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, suiteId: true, parentSectionId: true, name: true }
    });
  }

  async createSection(input: Omit<SectionRow, "id">): Promise<SectionRow> {
    return this.prisma.section.create({
      data: { suiteId: input.suiteId, parentSectionId: input.parentSectionId, name: input.name },
      select: { id: true, suiteId: true, parentSectionId: true, name: true }
    });
  }

  async updateSection(
    sectionId: bigint,
    patch: Partial<Omit<SectionRow, "id" | "suiteId">>
  ): Promise<SectionRow | null> {
    const found = await this.getSection(sectionId);
    if (!found) return null;
    return this.prisma.section.update({
      where: { id: sectionId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.parentSectionId !== undefined ? { parentSectionId: patch.parentSectionId } : {})
      },
      select: { id: true, suiteId: true, parentSectionId: true, name: true }
    });
  }

  async deleteSection(sectionId: bigint): Promise<boolean> {
    const found = await this.getSection(sectionId);
    if (!found) return false;
    await this.prisma.section.update({
      where: { id: sectionId },
      data: { deletedAt: new Date() }
    });
    return true;
  }

  async getSection(sectionId: bigint): Promise<SectionRow | null> {
    return this.prisma.section.findFirst({
      where: { id: sectionId, deletedAt: null },
      select: { id: true, suiteId: true, parentSectionId: true, name: true }
    });
  }

  async listCasesForSuite(projectId: bigint, suiteId: bigint): Promise<CaseRow[]> {
    return this.prisma.testCase.findMany({
      where: { projectId, suiteId, deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, sectionId: true, title: true, priority: true, caseType: true }
    });
  }

  async listCases(params: { projectId?: bigint; sectionId?: bigint; q?: string }): Promise<CaseRow[]> {
    return this.prisma.testCase.findMany({
      where: {
        deletedAt: null,
        ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
        ...(params.sectionId !== undefined ? { sectionId: params.sectionId } : {}),
        ...(params.q ? { title: { contains: params.q, mode: "insensitive" } } : {})
      },
      orderBy: { id: "asc" },
      select: { id: true, sectionId: true, title: true, priority: true, caseType: true }
    });
  }

  async createCase(input: Omit<CaseRow, "id">): Promise<CaseRow> {
    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId, deletedAt: null },
      select: { suiteId: true }
    });
    if (!section) {
      throw new Error("section not found");
    }
    const suite = await this.prisma.testSuite.findFirst({
      where: { id: section.suiteId, deletedAt: null },
      select: { projectId: true }
    });
    if (!suite) {
      throw new Error("suite not found");
    }
    return this.prisma.testCase.create({
      data: {
        projectId: suite.projectId,
        suiteId: section.suiteId,
        sectionId: input.sectionId,
        title: input.title,
        priority: input.priority,
        caseType: input.caseType
      },
      select: { id: true, sectionId: true, title: true, priority: true, caseType: true }
    });
  }

  async getCase(caseId: bigint): Promise<CaseRow | null> {
    return this.prisma.testCase.findFirst({
      where: { id: caseId, deletedAt: null },
      select: { id: true, sectionId: true, title: true, priority: true, caseType: true }
    });
  }

  async updateCase(
    caseId: bigint,
    patch: Partial<Omit<CaseRow, "id" | "sectionId">>
  ): Promise<CaseRow | null> {
    const found = await this.getCase(caseId);
    if (!found) return null;
    return this.prisma.testCase.update({
      where: { id: caseId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.caseType !== undefined ? { caseType: patch.caseType } : {})
      },
      select: { id: true, sectionId: true, title: true, priority: true, caseType: true }
    });
  }

  async deleteCase(caseId: bigint): Promise<boolean> {
    const found = await this.getCase(caseId);
    if (!found) return false;
    await this.prisma.testCase.update({
      where: { id: caseId },
      data: { deletedAt: new Date() }
    });
    return true;
  }
}
