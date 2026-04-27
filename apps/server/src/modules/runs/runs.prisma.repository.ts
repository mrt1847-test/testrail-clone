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
          source: input.source ?? "manual"
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
      titleSnapshot: r.titleSnapshot,
      prioritySnapshot: r.prioritySnapshot,
      typeSnapshot: r.typeSnapshot,
      estimateSnapshot: r.estimateSnapshot,
      automationKeySnapshot: r.automationKeySnapshot,
      externalIdSnapshot: r.externalIdSnapshot
    }));
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
