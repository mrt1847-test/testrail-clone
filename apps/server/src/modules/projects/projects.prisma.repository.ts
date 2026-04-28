import type { PrismaClient, Prisma } from "@prisma/client";

import type {
  CaseRow,
  CaseStepRow,
  ProjectRow,
  ProjectsRepository,
  SectionRow,
  SuiteRow
} from "./projects.repository.js";

function mapCaseStepRow(r: {
  id: bigint;
  stepOrder: number;
  content: string;
  expectedResult: string | null;
}): CaseStepRow {
  return {
    id: r.id,
    stepOrder: r.stepOrder,
    content: r.content,
    expectedResult: r.expectedResult ?? null
  };
}

export class ProjectsPrismaRepository implements ProjectsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Avoid unique(caseId, stepOrder) violations while rewriting contiguous orders 1..n */
  private async solidifyStepOrders(tx: Prisma.TransactionClient, orderedIds: bigint[]) {
    const bump = 1_000_000;
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx.testCaseStep.update({
        where: { id: orderedIds[i]! },
        data: { stepOrder: bump + i }
      });
    }
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx.testCaseStep.update({
        where: { id: orderedIds[i]! },
        data: { stepOrder: i + 1 }
      });
    }
  }

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
      select: { id: true, sectionId: true, title: true, priority: true, caseType: true, preconditions: true }
    });
  }

  async listCases(params: { projectId?: bigint; suiteId?: bigint; sectionId?: bigint; q?: string }): Promise<CaseRow[]> {
    return this.prisma.testCase.findMany({
      where: {
        deletedAt: null,
        ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
        ...(params.suiteId !== undefined ? { suiteId: params.suiteId } : {}),
        ...(params.sectionId !== undefined ? { sectionId: params.sectionId } : {}),
        ...(params.q ? { title: { contains: params.q, mode: "insensitive" } } : {})
      },
      orderBy: { id: "asc" },
      select: { id: true, sectionId: true, title: true, priority: true, caseType: true, preconditions: true }
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
        caseType: input.caseType,
        ...(input.preconditions !== undefined && input.preconditions !== null
          ? { preconditions: input.preconditions }
          : {})
      },
      select: { id: true, sectionId: true, title: true, priority: true, caseType: true, preconditions: true }
    });
  }

  async getCase(caseId: bigint): Promise<CaseRow | null> {
    return this.prisma.testCase.findFirst({
      where: { id: caseId, deletedAt: null },
      select: {
        id: true,
        sectionId: true,
        title: true,
        priority: true,
        caseType: true,
        preconditions: true
      }
    });
  }

  async listCaseSteps(caseId: bigint): Promise<CaseStepRow[]> {
    const rows = await this.prisma.testCaseStep.findMany({
      where: { caseId, deletedAt: null },
      orderBy: { stepOrder: "asc" },
      select: { id: true, stepOrder: true, content: true, expectedResult: true }
    });
    return rows.map((r: (typeof rows)[number]) => mapCaseStepRow(r));
  }

  async createCaseStep(input: {
    caseId: bigint;
    stepOrder: number;
    content: string;
    expectedResult?: string | null;
  }): Promise<CaseStepRow> {
    const row = await this.prisma.testCaseStep.create({
      data: {
        caseId: input.caseId,
        stepOrder: input.stepOrder,
        content: input.content,
        expectedResult: input.expectedResult ?? undefined
      },
      select: { id: true, stepOrder: true, content: true, expectedResult: true }
    });
    return mapCaseStepRow(row);
  }

  async updateCaseStep(
    stepId: bigint,
    patch: { content?: string; expectedResult?: string | null; stepOrder?: number }
  ): Promise<CaseStepRow | null> {
    const found = await this.prisma.testCaseStep.findFirst({
      where: { id: stepId, deletedAt: null },
      select: { id: true, caseId: true, stepOrder: true, content: true, expectedResult: true }
    });
    if (!found) return null;

    if (patch.stepOrder === undefined || patch.stepOrder === found.stepOrder) {
      const row = await this.prisma.testCaseStep.update({
        where: { id: stepId },
        data: {
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.expectedResult !== undefined ? { expectedResult: patch.expectedResult } : {})
        },
        select: { id: true, stepOrder: true, content: true, expectedResult: true }
      });
      return mapCaseStepRow(row);
    }

    const desiredOrder = patch.stepOrder;
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const all = await tx.testCaseStep.findMany({
        where: { caseId: found.caseId, deletedAt: null },
        orderBy: { stepOrder: "asc" },
        select: { id: true, stepOrder: true, content: true, expectedResult: true }
      });
      const moving = all.find((s: (typeof all)[number]) => s.id === stepId);
      if (!moving) return null;
      const rest = all.filter((s: (typeof all)[number]) => s.id !== stepId);
      const targetPos = Math.min(Math.max(1, desiredOrder), all.length);
      const idx = targetPos - 1;
      const reordered = [...rest.slice(0, idx), moving, ...rest.slice(idx)];
      await this.solidifyStepOrders(
        tx,
        reordered.map((s) => s.id)
      );
      const row = await tx.testCaseStep.update({
        where: { id: stepId },
        data: {
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.expectedResult !== undefined ? { expectedResult: patch.expectedResult } : {})
        },
        select: { id: true, stepOrder: true, content: true, expectedResult: true }
      });
      return mapCaseStepRow(row);
    });
  }

  async deleteCaseStep(stepId: bigint): Promise<boolean> {
    const found = await this.prisma.testCaseStep.findFirst({
      where: { id: stepId, deletedAt: null },
      select: { id: true, caseId: true }
    });
    if (!found) return false;
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.testCaseStep.update({
        where: { id: stepId },
        data: { deletedAt: new Date() }
      });
      const remaining = await tx.testCaseStep.findMany({
        where: { caseId: found.caseId, deletedAt: null },
        orderBy: { stepOrder: "asc" },
        select: { id: true }
      });
      if (remaining.length > 0) {
        await this.solidifyStepOrders(
          tx,
          remaining.map((r: (typeof remaining)[number]) => r.id)
        );
      }
    });
    return true;
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
        ...(patch.caseType !== undefined ? { caseType: patch.caseType } : {}),
        ...(patch.preconditions !== undefined ? { preconditions: patch.preconditions } : {})
      },
      select: {
        id: true,
        sectionId: true,
        title: true,
        priority: true,
        caseType: true,
        preconditions: true
      }
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
