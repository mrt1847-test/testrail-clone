import type { PrismaClient } from "@prisma/client";
import { isActiveAssignmentStatus } from "@testrail-clone/shared";

import { buildProjectExecutionSummary, type ProjectRunRollupInput } from "../../domain/projectExecutionSummary.js";
import { buildUserWorkloadSummary } from "../../domain/userWorkloadSummary.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { toRunSummaryMetrics } from "./reportMetrics.service.js";

async function loadOverviewCounts(
  projectId: bigint,
  deps: { prisma?: PrismaClient; catalog?: ProjectsRepository; repo: RunsRepository }
) {
  if (deps.prisma) {
    const [totalCases, mappedCases] = await Promise.all([
      deps.prisma.testCase.count({ where: { projectId, archivedAt: null, deletedAt: null } }),
      deps.prisma.testCase.count({
        where: { projectId, archivedAt: null, deletedAt: null, automationKey: { not: null } }
      })
    ]);
    return {
      totalCases,
      automationCoveragePct: totalCases === 0 ? 0 : Math.round((mappedCases / totalCases) * 100)
    };
  }
  if (deps.catalog) {
    const cases = await deps.catalog.listCases({ projectId, state: "active" });
    const mapped = cases.filter((row) => row.automationKey && row.automationKey.trim().length > 0).length;
    return {
      totalCases: cases.length,
      automationCoveragePct: cases.length === 0 ? 0 : Math.round((mapped / cases.length) * 100)
    };
  }
  return { totalCases: 0, automationCoveragePct: 0 };
}

async function loadRunRollups(
  projectId: bigint,
  repo: RunsRepository
): Promise<{ runs: ProjectRunRollupInput[]; executionStatuses: string[] }> {
  const runs = await repo.listRunsByProject(projectId);
  const rollups: ProjectRunRollupInput[] = [];
  const executionStatuses: string[] = [];

  for (const run of runs) {
    const instances = await repo.listInstancesForRun(run.id);
    for (const instance of instances) {
      executionStatuses.push(instance.status);
    }
    const metrics = toRunSummaryMetrics(instances.map((item) => item.status));
    rollups.push({
      runId: run.id.toString(),
      name: run.name,
      status: run.status,
      total: metrics.total,
      passed: metrics.passed,
      failed: metrics.failed,
      progress: metrics.progress
    });
  }

  return { runs: rollups, executionStatuses };
}

async function countUnassignedActiveTests(
  projectId: bigint,
  deps: { prisma?: PrismaClient; repo: RunsRepository }
) {
  if (deps.prisma) {
    return deps.prisma.testInstance.count({
      where: {
        deletedAt: null,
        assignedTo: null,
        status: { in: ["untested", "failed", "blocked", "retest"] },
        run: { projectId, deletedAt: null, status: "open" }
      }
    });
  }

  const runs = await deps.repo.listRunsByProject(projectId);
  const openRunIds = new Set(runs.filter((run) => run.status === "open").map((run) => run.id));
  let count = 0;
  for (const runId of openRunIds) {
    const instances = await deps.repo.listInstancesForRun(runId);
    for (const instance of instances) {
      if (!instance.assignedTo && isActiveAssignmentStatus(instance.status)) count += 1;
    }
  }
  return count;
}

export async function buildProjectExecutionSummaryForProject(
  projectId: bigint,
  deps: { prisma?: PrismaClient; catalog?: ProjectsRepository; repo: RunsRepository }
) {
  const [overview, payload] = await Promise.all([
    loadOverviewCounts(projectId, deps),
    loadRunRollups(projectId, deps.repo)
  ]);

  return buildProjectExecutionSummary({
    totalCases: overview.totalCases,
    automationCoveragePct: overview.automationCoveragePct,
    runs: payload.runs,
    executionStatuses: payload.executionStatuses
  });
}

export async function buildUserWorkloadSummaryForProject(
  projectId: bigint,
  deps: { prisma?: PrismaClient; repo: RunsRepository }
) {
  const rows = await deps.repo.listTeamTodoTests({ projectId, assigneeId: "all" });
  const mapped = rows
    .filter((row) => row.assignedTo != null)
    .map((row) => ({
      userId: row.assignedTo!.toString(),
      name: row.assignee?.name ?? `User ${row.assignedTo!.toString()}`,
      email: row.assignee?.email ?? "",
      status: row.status,
      agingLevel: row.agingLevel
    }));

  const unassignedActiveCount = await countUnassignedActiveTests(projectId, deps);
  return buildUserWorkloadSummary(mapped, unassignedActiveCount);
}
