import type { PrismaClient, Prisma } from "@prisma/client";

import type { ResultInput } from "../results/results.types.js";
import type { RunsRepository, Tx } from "./runs.repository.js";
import type { TestCase, TestInstance, TestRun } from "./runs.types.js";

function mapStatus(status: string) {
  return status as TestInstance["status"];
}

function toTxAdapter(tx: Prisma.TransactionClient): Tx {
  return {
    async createRun(input) {
      const row = await tx.testRun.create({
        data: {
          projectId: input.projectId,
          suiteId: input.suiteId,
          milestoneId: input.milestoneId ?? null,
          name: input.name,
          includeAll: input.includeAll,
          assignedTo: input.assignedTo ?? null,
          environment: input.environment ?? null
        }
      });
      return row as TestRun;
    },
    async getCasesForRun(input) {
      const rows = await tx.testCase.findMany({
        where: {
          projectId: input.projectId,
          suiteId: input.suiteId,
          ...(input.includeAll ? {} : { id: { in: input.caseIds ?? [] } })
        }
      });
      return rows as TestCase[];
    },
    async createInstances(instances) {
      if (instances.length === 0) return [];
      await tx.testInstance.createMany({
        data: instances.map((i) => ({
          runId: i.runId,
          caseId: i.caseId,
          assignedTo: i.assignedTo ?? null,
          titleSnapshot: i.titleSnapshot,
          prioritySnapshot: i.prioritySnapshot,
          typeSnapshot: i.typeSnapshot,
          estimateSnapshot: i.estimateSnapshot,
          automationKeySnapshot: i.automationKeySnapshot,
          externalIdSnapshot: i.externalIdSnapshot
        }))
      });
      const rows = await tx.testInstance.findMany({
        where: { runId: instances[0].runId },
        orderBy: { id: "asc" }
      });
      return rows.map((r: { status: string } & Record<string, unknown>) => ({ ...r, status: mapStatus(r.status) })) as TestInstance[];
    },
    async getRunById(runId) {
      const row = await tx.testRun.findFirst({
        where: { id: runId, deletedAt: null }
      });
      if (!row) return null;
      return {
        id: row.id,
        projectId: row.projectId,
        suiteId: row.suiteId,
        milestoneId: row.milestoneId ?? null,
        name: row.name,
        includeAll: row.includeAll,
        status: row.status === "closed" ? "closed" : "open",
        assignedTo: row.assignedTo ?? null,
        environment: row.environment ?? null
      };
    },
    async getInstancesByRunId(runId) {
      const rows = await tx.testInstance.findMany({
        where: { runId },
        select: { status: true }
      });
      return rows.map((r: { status: string }) => ({ status: mapStatus(r.status) }));
    },
    async getTestInstanceById(testId) {
      const row = await tx.testInstance.findUnique({ where: { id: testId } });
      return row ? ({ ...row, status: mapStatus(row.status) } as TestInstance) : null;
    },
    async getTestInstanceByCaseInRun(runId, caseId) {
      const row = await tx.testInstance.findFirst({ where: { runId, caseId } });
      return row ? ({ ...row, status: mapStatus(row.status) } as TestInstance) : null;
    },
    async createResult(testInstanceId, input: ResultInput) {
      const row = await tx.testResult.create({
        data: {
          testInstanceId,
          status: input.status,
          comment: input.comment,
          elapsed: input.elapsed,
          version: input.version,
          defects: input.defects ?? [],
          customValues: (input.customValues as Prisma.InputJsonValue | undefined) ?? undefined,
          source: input.source ?? "manual",
          metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined
        }
      });
      return { id: row.id, testInstanceId: row.testInstanceId, status: mapStatus(row.status) };
    },
    async createResultSteps(resultId, steps) {
      await tx.testResultStep.createMany({
        data: steps.map((s) => ({
          resultId,
          stepOrder: s.stepOrder,
          status: s.status,
          actualResult: s.actualResult,
          comment: s.comment
        }))
      });
    },
    async updateInstanceStatus(testInstanceId, status) {
      await tx.testInstance.update({
        where: { id: testInstanceId },
        data: { status }
      });
    },
    async closeRun(runId) {
      await tx.testRun.update({
        where: { id: runId },
        data: { status: "closed", closedAt: new Date() }
      });
    },
    async updateRun(runId, input) {
      await tx.testRun.update({
        where: { id: runId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {})
        }
      });
    },
    async updateTestAssignee(testId, assignedTo) {
      await tx.testInstance.update({
        where: { id: testId },
        data: { assignedTo }
      });
    },
    async getResultsByTestInstanceId(testId) {
      const rows = await tx.testResult.findMany({
        where: { testInstanceId: testId },
        orderBy: { id: "desc" }
      });
      return rows.map((row: (typeof rows)[number]) => ({
        id: row.id,
        testInstanceId: row.testInstanceId,
        status: mapStatus(row.status),
        comment: row.comment ?? undefined,
        elapsed: row.elapsed ?? undefined,
        version: row.version ?? undefined,
        defects: row.defects,
        customValues:
          row.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues)
            ? (row.customValues as Record<string, string | number | boolean | null>)
            : {},
        source: row.source as "manual" | "automation" | "api",
        createdAt: row.createdAt
      }));
    },
    async getResultStepsByResultId(resultId) {
      const rows = await tx.testResultStep.findMany({
        where: { resultId },
        orderBy: { stepOrder: "asc" }
      });
      return rows.map((row: (typeof rows)[number]) => ({
        id: row.id,
        resultId: row.resultId,
        stepOrder: row.stepOrder,
        status: mapStatus(row.status),
        actualResult: row.actualResult ?? undefined,
        comment: row.comment ?? undefined,
        createdAt: row.createdAt
      }));
    }
  };
}

export class PrismaRunsRepository implements RunsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => fn(toTxAdapter(tx)));
  }

  async listRunsByProject(projectId: bigint): Promise<TestRun[]> {
    type Row = {
      id: bigint;
      projectId: bigint;
      suiteId: bigint;
      milestoneId: bigint | null;
      name: string;
      includeAll: boolean;
      status: string;
      assignedTo: bigint | null;
      environment: string | null;
    };
    const rows = (await this.prisma.testRun.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "desc" }
    })) as Row[];
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      suiteId: r.suiteId,
      milestoneId: r.milestoneId ?? null,
      name: r.name,
      includeAll: r.includeAll,
      status: r.status === "closed" ? "closed" : "open",
      assignedTo: r.assignedTo ?? null,
      environment: r.environment ?? null
    }));
  }

  async getRun(runId: bigint): Promise<TestRun | null> {
    const r = await this.prisma.testRun.findFirst({
      where: { id: runId, deletedAt: null }
    });
    if (!r) return null;
    return {
      id: r.id,
      projectId: r.projectId,
      suiteId: r.suiteId,
      milestoneId: r.milestoneId ?? null,
      name: r.name,
      includeAll: r.includeAll,
      status: r.status === "closed" ? "closed" : "open",
      assignedTo: r.assignedTo ?? null,
      environment: r.environment ?? null
    };
  }

  async listInstancesForRun(runId: bigint): Promise<TestInstance[]> {
    type Row = {
      id: bigint;
      runId: bigint;
      caseId: bigint;
      status: string;
      assignedTo: bigint | null;
      titleSnapshot: string;
      prioritySnapshot: string | null;
      typeSnapshot: string | null;
      estimateSnapshot: string | null;
      automationKeySnapshot: string | null;
      externalIdSnapshot: string | null;
    };
    const rows = (await this.prisma.testInstance.findMany({
      where: { runId, deletedAt: null },
      orderBy: { id: "asc" }
    })) as Row[];
    return rows.map((r) => ({
      id: r.id,
      runId: r.runId,
      caseId: r.caseId,
      status: mapStatus(r.status),
      assignedTo: r.assignedTo ?? null,
      titleSnapshot: r.titleSnapshot,
      prioritySnapshot: r.prioritySnapshot,
      typeSnapshot: r.typeSnapshot,
      estimateSnapshot: r.estimateSnapshot,
      automationKeySnapshot: r.automationKeySnapshot,
      externalIdSnapshot: r.externalIdSnapshot
    }));
  }

  async listInstancesForRunPage(input: {
    runId: bigint;
    page: number;
    pageSize: number;
    status?: TestInstance["status"];
    assignedTo?: bigint | null;
    q?: string;
  }): Promise<{ items: TestInstance[]; total: number }> {
    type Row = {
      id: bigint;
      runId: bigint;
      caseId: bigint;
      status: string;
      assignedTo: bigint | null;
      titleSnapshot: string;
      prioritySnapshot: string | null;
      typeSnapshot: string | null;
      estimateSnapshot: string | null;
      automationKeySnapshot: string | null;
      externalIdSnapshot: string | null;
    };
    const where: Prisma.TestInstanceWhereInput = {
      runId: input.runId,
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
      ...(input.q
        ? {
            OR: [
              { titleSnapshot: { contains: input.q, mode: "insensitive" } },
              { caseId: { equals: /^\d+$/.test(input.q.replace(/^c/i, "")) ? BigInt(input.q.replace(/^c/i, "")) : -1n } }
            ]
          }
        : {})
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.testInstance.findMany({
        where,
        orderBy: { id: "asc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.testInstance.count({ where })
    ]);
    return {
      items: (rows as Row[]).map((r) => ({
        id: r.id,
        runId: r.runId,
        caseId: r.caseId,
        status: mapStatus(r.status),
        assignedTo: r.assignedTo ?? null,
        titleSnapshot: r.titleSnapshot,
        prioritySnapshot: r.prioritySnapshot,
        typeSnapshot: r.typeSnapshot,
        estimateSnapshot: r.estimateSnapshot,
        automationKeySnapshot: r.automationKeySnapshot,
        externalIdSnapshot: r.externalIdSnapshot
      })),
      total
    };
  }

  async closeRun(runId: bigint): Promise<TestRun | null> {
    const row = await this.prisma.testRun.findFirst({
      where: { id: runId, deletedAt: null }
    });
    if (!row) return null;
    const updated = await this.prisma.testRun.update({
      where: { id: runId },
      data: { status: "closed", closedAt: new Date() }
    });
    return {
      id: updated.id,
      projectId: updated.projectId,
      suiteId: updated.suiteId,
      milestoneId: updated.milestoneId ?? null,
      name: updated.name,
      includeAll: updated.includeAll,
      status: "closed",
      assignedTo: updated.assignedTo ?? null,
      environment: updated.environment ?? null
    };
  }

  async updateRun(runId: bigint, input: { name?: string; assignedTo?: bigint | null }): Promise<TestRun | null> {
    const row = await this.prisma.testRun.findFirst({
      where: { id: runId, deletedAt: null }
    });
    if (!row) return null;
    const updated = await this.prisma.testRun.update({
      where: { id: runId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {})
      }
    });
    return {
      id: updated.id,
      projectId: updated.projectId,
      suiteId: updated.suiteId,
      milestoneId: updated.milestoneId ?? null,
      name: updated.name,
      includeAll: updated.includeAll,
      status: updated.status === "closed" ? "closed" : "open",
      assignedTo: updated.assignedTo ?? null,
      environment: updated.environment ?? null
    };
  }

  async updateTestAssignee(testId: bigint, assignedTo: bigint | null): Promise<TestInstance | null> {
    const row = await this.prisma.testInstance.findFirst({
      where: { id: testId, deletedAt: null }
    });
    if (!row) return null;
    const updated = await this.prisma.testInstance.update({
      where: { id: testId },
      data: { assignedTo }
    });
    return {
      id: updated.id,
      runId: updated.runId,
      caseId: updated.caseId,
      status: mapStatus(updated.status),
      assignedTo: updated.assignedTo ?? null,
      titleSnapshot: updated.titleSnapshot,
      prioritySnapshot: updated.prioritySnapshot,
      typeSnapshot: updated.typeSnapshot,
      estimateSnapshot: updated.estimateSnapshot,
      automationKeySnapshot: updated.automationKeySnapshot,
      externalIdSnapshot: updated.externalIdSnapshot
    };
  }

  async listAssignedTests(input: { projectId: bigint; userId: bigint }) {
    const rows = await this.prisma.testInstance.findMany({
      where: {
        assignedTo: input.userId,
        deletedAt: null,
        run: { projectId: input.projectId, deletedAt: null }
      },
      include: {
        run: { select: { id: true, name: true } },
        testCase: { select: { id: true, title: true } }
      },
      orderBy: { id: "desc" },
      take: 200
    });
    return rows.map((row: (typeof rows)[number]) => ({
      testId: row.id,
      runId: row.run.id,
      runName: row.run.name,
      caseId: row.testCase.id,
      title: row.testCase.title,
      status: mapStatus(row.status),
      assignedTo: row.assignedTo ?? null
    }));
  }

  async listResultsForTestInstance(testId: bigint) {
    const rows = await this.prisma.testResult.findMany({
      where: { testInstanceId: testId },
      orderBy: { id: "desc" }
    });
    return rows.map((row: (typeof rows)[number]) => ({
      id: row.id,
      testInstanceId: row.testInstanceId,
      status: mapStatus(row.status),
      comment: row.comment ?? undefined,
      elapsed: row.elapsed ?? undefined,
      version: row.version ?? undefined,
      defects: row.defects,
      customValues:
        row.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues)
          ? (row.customValues as Record<string, string | number | boolean | null>)
          : {},
      source: row.source as "manual" | "automation" | "api",
      createdAt: row.createdAt
    }));
  }

  async listResultStepsByResultId(resultId: bigint) {
    const rows = await this.prisma.testResultStep.findMany({
      where: { resultId },
      orderBy: { stepOrder: "asc" }
    });
    return rows.map((row: (typeof rows)[number]) => ({
      id: row.id,
      resultId: row.resultId,
      stepOrder: row.stepOrder,
      status: mapStatus(row.status),
      actualResult: row.actualResult ?? undefined,
      comment: row.comment ?? undefined,
      createdAt: row.createdAt
    }));
  }
}
