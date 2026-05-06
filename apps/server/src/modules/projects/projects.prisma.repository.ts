import type { PrismaClient, Prisma } from "@prisma/client";

import type {
  CaseRow,
  CasePresenceFilter,
  CaseStepRow,
  CaseVersionRow,
  ProjectRow,
  ProjectsRepository,
  SectionRow,
  SuiteRow
} from "./projects.repository.js";

function serializeCaseSnapshot(input: {
  title: string;
  priority?: string | null;
  caseType?: string | null;
  preconditions?: string | null;
  customValues?: Record<string, string | number | boolean | null>;
  stepsSnapshot: Array<{ stepOrder: number; content: string; expectedResult?: string | null }>;
}) {
  return JSON.stringify(input);
}

function jsonObject(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
      out[key] = item;
    }
  }
  return out;
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
  sectionId: true,
  title: true,
  priority: true,
  caseType: true,
  estimate: true,
  refs: true,
  labels: true,
  automationKey: true,
  externalId: true,
  preconditions: true,
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
  sectionId: bigint;
  title: string;
  priority: string | null;
  caseType: string | null;
  estimate: string | null;
  refs: string | null;
  labels: string[];
  automationKey: string | null;
  externalId: string | null;
  preconditions: string | null;
  customValues: unknown;
  lockVersion: number;
  updatedAt: Date;
  archivedAt: Date | null;
}): CaseRow {
  return {
    id: row.id,
    projectId: row.projectId,
    sectionId: row.sectionId,
    title: row.title,
    priority: row.priority,
    caseType: row.caseType,
    estimate: row.estimate,
    refs: row.refs,
    labels: row.labels,
    automationKey: row.automationKey,
    externalId: row.externalId,
    preconditions: row.preconditions,
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

  async listCasesForSuite(projectId: bigint, suiteId: bigint, state: "active" | "archived" | "all" = "active"): Promise<CaseRow[]> {
    const rows = await this.prisma.testCase.findMany({
      where: { projectId, suiteId, deletedAt: null, ...caseStateWhere(state) },
      orderBy: { id: "asc" },
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
    state?: "active" | "archived" | "all";
  }): Promise<CaseRow[]> {
    let sectionIds: bigint[] | undefined;
    if (params.sectionId !== undefined) {
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
      orderBy: { id: "asc" },
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
    const row = await this.prisma.testCase.create({
      data: {
        projectId: suite.projectId,
        suiteId: section.suiteId,
        sectionId: input.sectionId,
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
        stepsSnapshot
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
              : []) as Array<{ stepOrder: number; content: string; expectedResult?: string | null }>
        });
        if (latestSignature === snapshotSignature) return null;
      }

      const customValuesSnapshot = current.customValues ?? {};
      const stepsPayload = stepsSnapshot;

      const inserted = (await tx.$queryRaw`
        INSERT INTO "TestCaseVersion" ("caseId", "versionNo", "title", "priority", "caseType", "preconditions", "customValuesSnapshot", "stepsSnapshot", "changeReason")
        SELECT
          ${caseId},
          (SELECT COALESCE(MAX(v."versionNo"), 0) + 1 FROM "TestCaseVersion" v WHERE v."caseId" = ${caseId}),
          ${current.title},
          ${current.priority},
          ${current.caseType},
          ${current.preconditions},
          CAST(${customValuesSnapshot} AS jsonb),
          CAST(${stepsPayload} AS jsonb),
          ${reason ?? null}
        RETURNING "id", "caseId", "versionNo", "title", "priority", "caseType", "preconditions", "customValuesSnapshot", "stepsSnapshot", "changeReason", "createdAt"
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
    const row = await this.prisma.testCase.update({
      where: { id: caseId },
      data: {
        suiteId: targetSection.suiteId,
        sectionId: targetSectionId,
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
