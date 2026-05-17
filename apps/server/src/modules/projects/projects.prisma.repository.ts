import type { PrismaClient, Prisma } from "@prisma/client";

import { normalizeProjectType } from "../../domain/projectTypes.js";
import type {
  CaseRow,
  CasePresenceFilter,
  CaseScenarioRow,
  CaseStepRow,
  CaseVersionRow,
  ProjectRow,
  ProjectsRepository,
  SectionRow,
  SuiteRow,
  CaseCustomValue
} from "./projects.repository.js";
import { bootstrapProjectCatalog } from "./projectBootstrap.service.js";
import {
  parseCaseVersionAttachmentSnapshots,
  toPersistedAttachmentSnapshots
} from "../cases/caseVersionAttachmentSnapshot.js";

function serializeCaseSnapshot(input: {
  title: string;
  priority?: string | null;
  caseType?: string | null;
  preconditions?: string | null;
  customValues?: Record<string, CaseCustomValue>;
  stepsSnapshot: Array<{ stepOrder: number; content: string; expectedResult?: string | null }>;
  attachmentSnapshots: unknown;
}) {
  return JSON.stringify(input);
}

function jsonObject(value: unknown): Record<string, CaseCustomValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, CaseCustomValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null ||
      (Array.isArray(item) && item.every((row) => typeof row === "string"))
    ) {
      out[key] = item;
    }
  }
  return out;
}

function jsonAttachmentSnapshots(value: unknown): CaseVersionRow["attachmentSnapshots"] {
  return parseCaseVersionAttachmentSnapshots(value).flatMap((row) => {
    if (!row.entityType || !row.entityId || !row.createdAt) return [];
    return [
      {
        id: row.attachmentId,
        entityType: row.entityType,
        entityId: row.entityId,
        stepOrder: row.stepOrder ?? null,
        fileName: row.fileName,
        contentType: row.contentType ?? null,
        storagePath: row.storageKey,
        fileSize: row.fileSize ?? null,
        createdAt: row.createdAt,
        createdBy: row.createdBy ?? null
      }
    ];
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

const caseSelect = {
  id: true,
  projectId: true,
  suiteId: true,
  sectionId: true,
  displayOrder: true,
  title: true,
  priority: true,
  caseType: true,
  estimate: true,
  refs: true,
  labels: true,
  automationKey: true,
  externalId: true,
  preconditions: true,
  expectedResult: true,
  caseTemplateId: true,
  customValues: true,
  lockVersion: true,
  updatedAt: true,
  archivedAt: true
} as const;

function caseStateWhere(state: "active" | "archived" | "all" = "active") {
  if (state === "archived") {
    return { archivedAt: { not: null } };
  }
  if (state === "all") {
    return {};
  }
  return { archivedAt: null };
}

function normalizeSearchTerm(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function caseMatchesSearch(
  row: Pick<
    CaseRow,
    "id" | "title" | "refs" | "labels" | "automationKey" | "externalId" | "customValues"
  >,
  q: string | undefined
) {
  const needle = normalizeSearchTerm(q);
  if (!needle) return true;
  const customValues = Object.values(row.customValues ?? {})
    .filter((value) => value != null && String(value).trim().length > 0)
    .map((value) => String(value).toLowerCase());
  const haystacks = [
    row.title,
    row.refs ?? "",
    row.automationKey ?? "",
    row.externalId ?? "",
    `c${row.id.toString()}`,
    ...(row.labels ?? []),
    ...customValues
  ].map((value) => value.toLowerCase());
  return haystacks.some((value) => value.includes(needle));
}

function hasText(value: string | null | undefined) {
  return value != null && value.trim().length > 0;
}

function hasLabels(value: string[] | undefined) {
  return (value ?? []).some((label) => label.trim().length > 0);
}

function matchesPresence(hasValue: boolean, filter: CasePresenceFilter | undefined) {
  if (filter === "with") return hasValue;
  if (filter === "without") return !hasValue;
  return true;
}

function expandSectionSubtreeIds(
  sections: Array<{ id: bigint; parentSectionId: bigint | null }>,
  rootSectionId: bigint
): bigint[] {
  const children = new Map<bigint | null, bigint[]>();
  for (const section of sections) {
    const parent = section.parentSectionId ?? null;
    const list = children.get(parent);
    if (list) list.push(section.id);
    else children.set(parent, [section.id]);
  }
  const out = new Set<bigint>();
  const stack = [rootSectionId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (out.has(current)) continue;
    out.add(current);
    const kids = children.get(current) ?? [];
    for (const kid of kids) stack.push(kid);
  }
  return [...out];
}

function caseMatchesPresence(
  row: Pick<CaseRow, "refs" | "labels" | "estimate">,
  params: { refs?: CasePresenceFilter; labels?: CasePresenceFilter; estimate?: CasePresenceFilter }
) {
  return (
    matchesPresence(hasText(row.refs), params.refs) &&
    matchesPresence(hasLabels(row.labels), params.labels) &&
    matchesPresence(hasText(row.estimate), params.estimate)
  );
}

function mapCaseRow(row: {
  id: bigint;
  projectId: bigint;
  suiteId: bigint;
  sectionId: bigint;
  displayOrder: number;
  title: string;
  priority: string | null;
  caseType: string | null;
  estimate: string | null;
  refs: string | null;
  labels: string[];
  automationKey: string | null;
  externalId: string | null;
  preconditions: string | null;
  expectedResult: string | null;
  caseTemplateId: bigint | null;
  customValues: unknown;
  lockVersion: number;
  updatedAt: Date;
  archivedAt: Date | null;
}): CaseRow {
  return {
    id: row.id,
    projectId: row.projectId,
    suiteId: row.suiteId,
    sectionId: row.sectionId,
    displayOrder: row.displayOrder,
    title: row.title,
    priority: row.priority,
    caseType: row.caseType,
    estimate: row.estimate,
    refs: row.refs,
    labels: row.labels,
    automationKey: row.automationKey,
    externalId: row.externalId,
    preconditions: row.preconditions,
    expectedResult: row.expectedResult,
    caseTemplateId: row.caseTemplateId,
    customValues: jsonObject(row.customValues),
    lockVersion: row.lockVersion,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  };
}

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
    const rows = await this.prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { id: "desc" },
      select: { id: true, name: true, description: true, projectType: true, isActive: true }
    });
    return rows.map((row) => this.toProjectRow(row));
  }

  private toProjectRow(row: {
    id: bigint;
    name: string;
    description: string | null;
    projectType: string;
    isActive: boolean;
  }): ProjectRow {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      projectType: normalizeProjectType(row.projectType),
      isArchived: !row.isActive
    };
  }

  async createProject(input: Omit<ProjectRow, "id" | "isArchived"> & { ownerUserId?: bigint }): Promise<ProjectRow> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.project.create({
        data: {
          name: input.name,
          description: input.description,
          projectType: input.projectType,
          ...(input.ownerUserId !== undefined
            ? { createdBy: input.ownerUserId, updatedBy: input.ownerUserId }
            : {})
        },
        select: { id: true, name: true, description: true, projectType: true, isActive: true }
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
      await bootstrapProjectCatalog(tx, {
        projectId: created.id,
        projectType: normalizeProjectType(created.projectType),
        actorUserId: input.ownerUserId
      });
      return this.toProjectRow(created);
    });
  }

  async getProject(projectId: bigint): Promise<ProjectRow | null> {
    const row = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, name: true, description: true, projectType: true, isActive: true }
    });
    return row ? this.toProjectRow(row) : null;
  }

  async updateProject(
    projectId: bigint,
    patch: Partial<Omit<ProjectRow, "id">>
  ): Promise<ProjectRow | null> {
    const found = await this.getProject(projectId);
    if (!found) return null;
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.isArchived !== undefined ? { isActive: !patch.isArchived } : {}),
        ...(patch.projectType !== undefined ? { projectType: patch.projectType } : {})
      },
      select: { id: true, name: true, description: true, projectType: true, isActive: true }
    });
    return this.toProjectRow(updated);
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
      orderBy: [{ isMaster: "desc" }, { isBaseline: "asc" }, { id: "asc" }],
      select: {
        id: true,
        projectId: true,
        name: true,
        description: true,
        isMaster: true,
        isBaseline: true,
        parentSuiteId: true
      }
    });
  }

  async createSuite(
    input: Omit<SuiteRow, "id" | "isMaster" | "isBaseline" | "parentSuiteId"> &
      Partial<Pick<SuiteRow, "isMaster" | "isBaseline" | "parentSuiteId">>
  ): Promise<SuiteRow> {
    return this.prisma.testSuite.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        isMaster: input.isMaster ?? false,
        isBaseline: input.isBaseline ?? false,
        parentSuiteId: input.parentSuiteId ?? null
      },
      select: {
        id: true,
        projectId: true,
        name: true,
        description: true,
        isMaster: true,
        isBaseline: true,
        parentSuiteId: true
      }
    });
  }

  async getSuite(suiteId: bigint): Promise<SuiteRow | null> {
    return this.prisma.testSuite.findFirst({
      where: { id: suiteId, deletedAt: null },
      select: {
        id: true,
        projectId: true,
        name: true,
        description: true,
        isMaster: true,
        isBaseline: true,
        parentSuiteId: true
      }
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
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {})
      },
      select: {
        id: true,
        projectId: true,
        name: true,
        description: true,
        isMaster: true,
        isBaseline: true,
        parentSuiteId: true
      }
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
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, suiteId: true, parentSectionId: true, displayOrder: true, name: true }
    });
  }

  async createSection(input: Omit<SectionRow, "id">): Promise<SectionRow> {
    const lastSection = await this.prisma.section.findFirst({
      where: { suiteId: input.suiteId, parentSectionId: input.parentSectionId ?? null, deletedAt: null },
      orderBy: [{ displayOrder: "desc" }, { id: "desc" }],
      select: { displayOrder: true }
    });
    return this.prisma.section.create({
      data: {
        suiteId: input.suiteId,
        parentSectionId: input.parentSectionId,
        displayOrder: input.displayOrder ?? (lastSection?.displayOrder ?? -1) + 1,
        name: input.name
      },
      select: { id: true, suiteId: true, parentSectionId: true, displayOrder: true, name: true }
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
        ...(patch.parentSectionId !== undefined ? { parentSectionId: patch.parentSectionId } : {}),
        ...(patch.displayOrder !== undefined ? { displayOrder: patch.displayOrder } : {})
      },
      select: { id: true, suiteId: true, parentSectionId: true, displayOrder: true, name: true }
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
      select: { id: true, suiteId: true, parentSectionId: true, displayOrder: true, name: true }
    });
  }

  async listCasesForSuite(projectId: bigint, suiteId: bigint, state: "active" | "archived" | "all" = "active"): Promise<CaseRow[]> {
    const rows = await this.prisma.testCase.findMany({
      where: { projectId, suiteId, deletedAt: null, ...caseStateWhere(state) },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: caseSelect
    });
    return rows.map(mapCaseRow);
  }

  async listCases(params: {
    projectId?: bigint;
    suiteId?: bigint;
    sectionId?: bigint;
    q?: string;
    priority?: string;
    caseType?: string;
    automation?: "manual" | "automated";
    refs?: CasePresenceFilter;
    labels?: CasePresenceFilter;
    estimate?: CasePresenceFilter;
    sectionScope?: "direct" | "subtree";
    state?: "active" | "archived" | "all";
  }): Promise<CaseRow[]> {
    let sectionIds: bigint[] | undefined;
    if (params.sectionId !== undefined) {
      if ((params.sectionScope ?? "subtree") === "direct") {
        sectionIds = [params.sectionId];
      } else {
        const rootSection = await this.prisma.section.findFirst({
          where: { id: params.sectionId, deletedAt: null },
          select: { suiteId: true }
        });
        if (!rootSection) return [];
        const allSections = await this.prisma.section.findMany({
          where: { suiteId: rootSection.suiteId, deletedAt: null },
          select: { id: true, parentSectionId: true }
        });
        sectionIds = expandSectionSubtreeIds(
          allSections.map((section) => ({ id: section.id, parentSectionId: section.parentSectionId ?? null })),
          params.sectionId
        );
      }
    }
    const rows = await this.prisma.testCase.findMany({
      where: {
        deletedAt: null,
        ...caseStateWhere(params.state),
        ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
        ...(params.suiteId !== undefined ? { suiteId: params.suiteId } : {}),
        ...(sectionIds ? { sectionId: { in: sectionIds } } : {}),
        ...(params.priority ? { priority: { equals: params.priority, mode: "insensitive" } } : {}),
        ...(params.caseType ? { caseType: { equals: params.caseType, mode: "insensitive" } } : {}),
        ...(params.automation === "automated"
          ? { automationKey: { not: null } }
          : params.automation === "manual"
            ? { automationKey: null }
            : {})
      },
      orderBy: [{ sectionId: "asc" }, { displayOrder: "asc" }, { id: "asc" }],
      select: caseSelect
    });
    return rows
      .map(mapCaseRow)
      .filter((row: CaseRow) => caseMatchesPresence(row, params))
      .filter((row: CaseRow) => caseMatchesSearch(row, params.q));
  }

  async createCase(input: Omit<CaseRow, "id" | "updatedAt" | "lockVersion">): Promise<CaseRow> {
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
    const lastCase = await this.prisma.testCase.findFirst({
      where: { sectionId: input.sectionId, deletedAt: null },
      orderBy: [{ displayOrder: "desc" }, { id: "desc" }],
      select: { displayOrder: true }
    });
    const row = await this.prisma.testCase.create({
      data: {
        projectId: suite.projectId,
        suiteId: section.suiteId,
        sectionId: input.sectionId,
        displayOrder: input.displayOrder ?? (lastCase?.displayOrder ?? -1) + 1,
        title: input.title,
        priority: input.priority,
        caseType: input.caseType,
        estimate: input.estimate,
        refs: input.refs,
        labels: input.labels ?? [],
        automationKey: input.automationKey,
        externalId: input.externalId,
        ...(input.preconditions !== undefined && input.preconditions !== null
          ? { preconditions: input.preconditions }
          : {}),
        ...(input.expectedResult !== undefined ? { expectedResult: input.expectedResult } : {}),
        ...(input.caseTemplateId !== undefined ? { caseTemplateId: input.caseTemplateId } : {}),
        customValues: input.customValues ?? {}
      },
      select: caseSelect
    });
    return mapCaseRow(row);
  }

  async getCase(caseId: bigint): Promise<CaseRow | null> {
    const row = await this.prisma.testCase.findFirst({
      where: { id: caseId, deletedAt: null },
      select: caseSelect
    });
    return row ? mapCaseRow(row) : null;
  }

  async listCaseSteps(caseId: bigint): Promise<CaseStepRow[]> {
    const rows = await this.prisma.testCaseStep.findMany({
      where: { caseId, deletedAt: null },
      orderBy: { stepOrder: "asc" },
      select: { id: true, stepOrder: true, content: true, expectedResult: true }
    });
    return rows.map((r: (typeof rows)[number]) => mapCaseStepRow(r));
  }

  async listCaseScenarios(caseId: bigint): Promise<CaseScenarioRow[]> {
    const rows = await this.prisma.testCaseScenario.findMany({
      where: { caseId, deletedAt: null },
      orderBy: { scenarioOrder: "asc" },
      select: { id: true, scenarioOrder: true, name: true, content: true }
    });
    return rows.map((row) => ({
      id: row.id,
      scenarioOrder: row.scenarioOrder,
      name: row.name,
      content: row.content
    }));
  }

  async createCaseScenario(input: {
    caseId: bigint;
    scenarioOrder: number;
    name: string;
    content: string;
  }): Promise<CaseScenarioRow> {
    const row = await this.prisma.testCaseScenario.create({
      data: {
        caseId: input.caseId,
        scenarioOrder: input.scenarioOrder,
        name: input.name,
        content: input.content
      },
      select: { id: true, scenarioOrder: true, name: true, content: true }
    });
    return {
      id: row.id,
      scenarioOrder: row.scenarioOrder,
      name: row.name,
      content: row.content
    };
  }

  async updateCaseScenario(
    scenarioId: bigint,
    patch: { name?: string; content?: string; scenarioOrder?: number }
  ): Promise<CaseScenarioRow | null> {
    const existing = await this.prisma.testCaseScenario.findFirst({
      where: { id: scenarioId, deletedAt: null },
      select: { id: true }
    });
    if (!existing) return null;
    const row = await this.prisma.testCaseScenario.update({
      where: { id: scenarioId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.scenarioOrder !== undefined ? { scenarioOrder: patch.scenarioOrder } : {})
      },
      select: { id: true, scenarioOrder: true, name: true, content: true }
    });
    return {
      id: row.id,
      scenarioOrder: row.scenarioOrder,
      name: row.name,
      content: row.content
    };
  }

  async deleteCaseScenario(scenarioId: bigint): Promise<boolean> {
    const existing = await this.prisma.testCaseScenario.findFirst({
      where: { id: scenarioId, deletedAt: null },
      select: { id: true, caseId: true }
    });
    if (!existing) return false;
    await this.prisma.testCaseScenario.update({
      where: { id: scenarioId },
      data: { deletedAt: new Date() }
    });
    const remaining = await this.prisma.testCaseScenario.findMany({
      where: { caseId: existing.caseId, deletedAt: null },
      orderBy: { scenarioOrder: "asc" },
      select: { id: true }
    });
    await this.prisma.$transaction(
      remaining.map((row, index) =>
        this.prisma.testCaseScenario.update({
          where: { id: row.id },
          data: { scenarioOrder: index + 1 }
        })
      )
    );
    return true;
  }

  async replaceCaseScenarios(
    caseId: bigint,
    scenarios: Array<{ name: string; content: string }>
  ): Promise<CaseScenarioRow[]> {
    await this.prisma.testCaseScenario.updateMany({
      where: { caseId, deletedAt: null },
      data: { deletedAt: new Date() }
    });
    const created: CaseScenarioRow[] = [];
    for (let i = 0; i < scenarios.length; i += 1) {
      created.push(
        await this.createCaseScenario({
          caseId,
          scenarioOrder: i + 1,
          name: scenarios[i]!.name,
          content: scenarios[i]!.content
        })
      );
    }
    return created;
  }

  async listCaseVersions(caseId: bigint): Promise<CaseVersionRow[]> {
    const rows = await this.prisma.testCaseVersion.findMany({
      where: { caseId },
      orderBy: { versionNo: "desc" }
    });
    return rows.map((row: (typeof rows)[number]) => this.mapCaseVersionRow(row));
  }

  async getCaseVersion(caseId: bigint, versionId: bigint): Promise<CaseVersionRow | null> {
    const row = await this.prisma.testCaseVersion.findFirst({
      where: { id: versionId, caseId }
    });
    return row ? this.mapCaseVersionRow(row) : null;
  }

  async getCaseVersionByVersionNo(caseId: bigint, versionNo: number): Promise<CaseVersionRow | null> {
    const row = await this.prisma.testCaseVersion.findFirst({
      where: { caseId, versionNo }
    });
    return row ? this.mapCaseVersionRow(row) : null;
  }

  private mapCaseVersionRow(row: {
    id: bigint;
    caseId: bigint;
    versionNo: number;
    title: string;
    priority: string | null;
    caseType: string | null;
    preconditions: string | null;
    customValuesSnapshot: unknown;
    stepsSnapshot: unknown;
    attachmentSnapshots: unknown;
    changeReason: string | null;
    createdAt: Date;
  }): CaseVersionRow {
    return {
      id: row.id,
      caseId: row.caseId,
      versionNo: row.versionNo,
      title: row.title,
      priority: row.priority ?? null,
      caseType: row.caseType ?? null,
      preconditions: row.preconditions ?? null,
      customValuesSnapshot: jsonObject(row.customValuesSnapshot),
      stepsSnapshot:
        (Array.isArray(row.stepsSnapshot)
          ? row.stepsSnapshot
          : []) as Array<{ stepOrder: number; content: string; expectedResult?: string | null }>,
      attachmentSnapshots: jsonAttachmentSnapshots(row.attachmentSnapshots),
      changeReason: row.changeReason ?? null,
      createdAt: row.createdAt
    };
  }

  async createCaseVersionSnapshot(caseId: bigint, reason?: string): Promise<CaseVersionRow | null> {
    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await this.createCaseVersionSnapshotOnce(caseId, reason);
      } catch (e) {
        if (!isPrismaUniqueViolation(e) || attempt === maxAttempts - 1) {
          throw e;
        }
        await sleep(Math.min(50 * 2 ** attempt, 400));
      }
    }
    return null;
  }

  /**
   * Locks the parent case row, dedupes by snapshot signature, then inserts a version row whose
   * `versionNo` is assigned inside the DB via a subquery (serialized by `FOR UPDATE`).
   */
  private async createCaseVersionSnapshotOnce(caseId: bigint, reason?: string): Promise<CaseVersionRow | null> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const locked = (await tx.$queryRaw`
        SELECT id FROM "TestCase" WHERE id = ${caseId} AND "deletedAt" IS NULL FOR UPDATE
      `) as Array<{ id: bigint }>;
      if (locked.length === 0) return null;

      const row = await tx.testCase.findFirst({
        where: { id: caseId, deletedAt: null },
        select: caseSelect
      });
      if (!row) return null;
      const current = mapCaseRow(row);

      const stepRows = await tx.testCaseStep.findMany({
        where: { caseId, deletedAt: null },
        orderBy: { stepOrder: "asc" },
        select: { id: true, stepOrder: true, content: true, expectedResult: true }
      });
      const stepsSnapshot = stepRows.map((s: (typeof stepRows)[number]) => ({
        stepOrder: s.stepOrder,
        content: s.content,
        expectedResult: s.expectedResult ?? null
      }));
      const stepOrderById = new Map(stepRows.map((step) => [step.id.toString(), step.stepOrder]));
      const attachmentRows = await tx.attachment.findMany({
        where: {
          deletedAt: null,
          OR: [
            { entityType: "case", entityId: caseId },
            ...(stepRows.length > 0
              ? [{ entityType: "case_step", entityId: { in: stepRows.map((step) => step.id) } }]
              : [])
          ]
        },
        orderBy: [{ entityType: "asc" }, { entityId: "asc" }, { id: "asc" }],
        select: {
          id: true,
          entityType: true,
          entityId: true,
          fileName: true,
          contentType: true,
          storagePath: true,
          fileSize: true,
          createdAt: true,
          createdBy: true
        }
      });
      const attachmentSnapshots = toPersistedAttachmentSnapshots(
        attachmentRows.flatMap((attachment) => {
          if (attachment.entityType !== "case" && attachment.entityType !== "case_step") return [];
          return [
            {
              id: attachment.id.toString(),
              entityType: attachment.entityType,
              entityId: attachment.entityId.toString(),
              stepOrder:
                attachment.entityType === "case_step"
                  ? (stepOrderById.get(attachment.entityId.toString()) ?? null)
                  : null,
              fileName: attachment.fileName,
              contentType: attachment.contentType ?? null,
              storagePath: attachment.storagePath,
              fileSize: attachment.fileSize?.toString() ?? null,
              createdAt: attachment.createdAt.toISOString(),
              createdBy: attachment.createdBy?.toString() ?? null
            }
          ];
        })
      );

      const latest = await tx.testCaseVersion.findFirst({
        where: { caseId },
        orderBy: { versionNo: "desc" }
      });

      const snapshotSignature = serializeCaseSnapshot({
        title: current.title,
        priority: current.priority ?? null,
        caseType: current.caseType ?? null,
        preconditions: current.preconditions ?? null,
        customValues: current.customValues ?? {},
        stepsSnapshot,
        attachmentSnapshots
      });
      if (latest) {
        const latestSignature = serializeCaseSnapshot({
          title: latest.title,
          priority: latest.priority ?? null,
          caseType: latest.caseType ?? null,
          preconditions: latest.preconditions ?? null,
          customValues: jsonObject(latest.customValuesSnapshot),
          stepsSnapshot:
            (Array.isArray(latest.stepsSnapshot)
              ? latest.stepsSnapshot
              : []) as Array<{ stepOrder: number; content: string; expectedResult?: string | null }>,
          attachmentSnapshots: jsonAttachmentSnapshots(latest.attachmentSnapshots)
        });
        if (latestSignature === snapshotSignature) return null;
      }

      const customValuesSnapshot = current.customValues ?? {};
      const stepsPayload = stepsSnapshot;
      const attachmentPayload = attachmentSnapshots;

      const inserted = (await tx.$queryRaw`
        INSERT INTO "TestCaseVersion" ("caseId", "versionNo", "title", "priority", "caseType", "preconditions", "customValuesSnapshot", "stepsSnapshot", "attachmentSnapshots", "changeReason")
        SELECT
          ${caseId},
          (SELECT COALESCE(MAX(v."versionNo"), 0) + 1 FROM "TestCaseVersion" v WHERE v."caseId" = ${caseId}),
          ${current.title},
          ${current.priority},
          ${current.caseType},
          ${current.preconditions},
          CAST(${customValuesSnapshot} AS jsonb),
          CAST(${stepsPayload} AS jsonb),
          CAST(${attachmentPayload} AS jsonb),
          ${reason ?? null}
        RETURNING "id", "caseId", "versionNo", "title", "priority", "caseType", "preconditions", "customValuesSnapshot", "stepsSnapshot", "attachmentSnapshots", "changeReason", "createdAt"
      `) as Array<{
        id: bigint;
        caseId: bigint;
        versionNo: number;
        title: string;
        priority: string | null;
        caseType: string | null;
        preconditions: string | null;
        customValuesSnapshot: unknown;
        stepsSnapshot: unknown;
        attachmentSnapshots: unknown;
        changeReason: string | null;
        createdAt: Date;
      }>;

      const created = inserted[0];
      if (!created) {
        throw new Error("expected TestCaseVersion row after INSERT");
      }
      return this.mapCaseVersionRow(created);
    });
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
    patch: Partial<Omit<CaseRow, "id" | "sectionId" | "updatedAt" | "lockVersion" | "archivedAt">>,
    expectedVersion?: number
  ): Promise<CaseRow | "conflict" | null> {
    const found = await this.getCase(caseId);
    if (!found) return null;
    if (expectedVersion !== undefined) {
      const updated = await this.prisma.testCase.updateMany({
        where: {
          id: caseId,
          deletedAt: null,
          lockVersion: expectedVersion
        },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.caseType !== undefined ? { caseType: patch.caseType } : {}),
          ...(patch.preconditions !== undefined ? { preconditions: patch.preconditions } : {}),
          ...(patch.expectedResult !== undefined ? { expectedResult: patch.expectedResult } : {}),
          ...(patch.caseTemplateId !== undefined ? { caseTemplateId: patch.caseTemplateId } : {}),
          ...(patch.refs !== undefined ? { refs: patch.refs } : {}),
          ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
          ...(patch.customValues !== undefined ? { customValues: patch.customValues } : {}),
          lockVersion: { increment: 1 }
        }
      });
      if (updated.count === 0) {
        return "conflict";
      }
      return this.getCase(caseId);
    }
    const row = await this.prisma.testCase.update({
      where: { id: caseId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.caseType !== undefined ? { caseType: patch.caseType } : {}),
        ...(patch.preconditions !== undefined ? { preconditions: patch.preconditions } : {}),
        ...(patch.expectedResult !== undefined ? { expectedResult: patch.expectedResult } : {}),
        ...(patch.caseTemplateId !== undefined ? { caseTemplateId: patch.caseTemplateId } : {}),
        ...(patch.refs !== undefined ? { refs: patch.refs } : {}),
        ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
        ...(patch.customValues !== undefined ? { customValues: patch.customValues } : {}),
        lockVersion: { increment: 1 }
      },
      select: caseSelect
    });
    return mapCaseRow(row);
  }

  async setCaseArchived(caseId: bigint, archived: boolean): Promise<CaseRow | "already_archived" | "already_active" | null> {
    const found = await this.getCase(caseId);
    if (!found) return null;
    if (archived && found.archivedAt) return "already_archived";
    if (!archived && !found.archivedAt) return "already_active";
    const row = await this.prisma.testCase.update({
      where: { id: caseId },
      data: {
        archivedAt: archived ? new Date() : null,
        lockVersion: { increment: 1 }
      },
      select: caseSelect
    });
    return mapCaseRow(row);
  }

  async moveCase(caseId: bigint, targetSectionId: bigint): Promise<CaseRow | null> {
    const found = await this.getCase(caseId);
    if (!found) return null;
    const targetSection = await this.prisma.section.findFirst({
      where: { id: targetSectionId, deletedAt: null },
      select: { suiteId: true }
    });
    if (!targetSection) return null;
    const lastCase = await this.prisma.testCase.findFirst({
      where: { sectionId: targetSectionId, deletedAt: null, id: { not: caseId } },
      orderBy: [{ displayOrder: "desc" }, { id: "desc" }],
      select: { displayOrder: true }
    });
    const row = await this.prisma.testCase.update({
      where: { id: caseId },
      data: {
        suiteId: targetSection.suiteId,
        sectionId: targetSectionId,
        displayOrder: (lastCase?.displayOrder ?? -1) + 1,
        lockVersion: { increment: 1 }
      },
      select: caseSelect
    });
    return mapCaseRow(row);
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
