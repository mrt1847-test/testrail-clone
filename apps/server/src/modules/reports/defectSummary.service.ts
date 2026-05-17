import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  buildDefectSummaryReport,
  type DefectSummaryScope,
  type DefectSummaryTestInput
} from "../../domain/defectSummary.js";
import { latestByCreatedAt } from "./reportMetrics.service.js";
import type { RunsRepository } from "../runs/runs.repository.js";

export const defectSummaryQuerySchema = z
  .object({
    milestoneId: z.coerce.bigint().optional(),
    planId: z.coerce.bigint().optional(),
    runId: z.coerce.bigint().optional()
  })
  .refine((query) => {
    const scopes = [query.milestoneId, query.planId, query.runId].filter((value) => value != null);
    return scopes.length <= 1;
  }, "Only one of milestoneId, planId, or runId may be set");

export type DefectSummaryQuery = z.infer<typeof defectSummaryQuerySchema>;

async function resolveScopeLabel(
  prisma: PrismaClient,
  projectId: bigint,
  query: DefectSummaryQuery
): Promise<DefectSummaryScope> {
  if (query.runId) {
    const run = await prisma.testRun.findFirst({
      where: { id: query.runId, projectId, deletedAt: null },
      select: { id: true, name: true }
    });
    return {
      type: "run",
      id: query.runId.toString(),
      label: run?.name ?? `Run ${query.runId.toString()}`
    };
  }
  if (query.milestoneId) {
    const milestone = await prisma.milestone.findFirst({
      where: { id: query.milestoneId, projectId, deletedAt: null },
      select: { id: true, name: true }
    });
    return {
      type: "milestone",
      id: query.milestoneId.toString(),
      label: milestone?.name ?? `Milestone ${query.milestoneId.toString()}`
    };
  }
  if (query.planId) {
    const plan = await prisma.testPlan.findFirst({
      where: { id: query.planId, projectId, deletedAt: null },
      select: { id: true, name: true }
    });
    return {
      type: "plan",
      id: query.planId.toString(),
      label: plan?.name ?? `Plan ${query.planId.toString()}`
    };
  }
  return { type: "project", id: null, label: "All runs" };
}

async function resolveRunIds(
  prisma: PrismaClient,
  projectId: bigint,
  query: DefectSummaryQuery
): Promise<bigint[]> {
  if (query.runId) {
    const run = await prisma.testRun.findFirst({
      where: { id: query.runId, projectId, deletedAt: null },
      select: { id: true }
    });
    return run ? [run.id] : [];
  }
  if (query.milestoneId) {
    const runs = await prisma.testRun.findMany({
      where: { projectId, milestoneId: query.milestoneId, deletedAt: null },
      select: { id: true }
    });
    return runs.map((row) => row.id);
  }
  if (query.planId) {
    const plan = await prisma.testPlan.findFirst({
      where: { id: query.planId, projectId, deletedAt: null },
      include: {
        runs: { where: { deletedAt: null }, select: { id: true } },
        entries: {
          where: { deletedAt: null },
          include: { run: { select: { id: true } } }
        }
      }
    });
    const ids = new Set<bigint>();
    for (const run of plan?.runs ?? []) ids.add(run.id);
    for (const entry of plan?.entries ?? []) {
      if (entry.run) ids.add(entry.run.id);
    }
    return [...ids];
  }
  const runs = await prisma.testRun.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true }
  });
  return runs.map((row) => row.id);
}

async function loadTestsFromPrisma(
  prisma: PrismaClient,
  projectId: bigint,
  runIds: bigint[]
): Promise<DefectSummaryTestInput[]> {
  if (runIds.length === 0) return [];
  const runs = await prisma.testRun.findMany({
    where: { projectId, id: { in: runIds }, deletedAt: null },
    orderBy: { id: "asc" },
    include: {
      instances: {
        where: { deletedAt: null },
        include: {
          results: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              defectLinks: {
                where: { deletedAt: null },
                select: { defectKey: true }
              }
            }
          }
        }
      }
    }
  });

  const tests: DefectSummaryTestInput[] = [];
  for (const run of runs) {
    for (const instance of run.instances) {
      const latest = latestByCreatedAt(instance.results);
      tests.push({
        runId: run.id.toString(),
        runName: run.name,
        testId: instance.id.toString(),
        caseId: instance.caseId.toString(),
        title: instance.titleSnapshot,
        latestResult: latest
          ? {
              resultId: latest.id.toString(),
              status: latest.status,
              defectKeys: [
                ...latest.defectLinks.map((link) => link.defectKey),
                ...(latest.defects ?? [])
              ],
              createdAt: latest.createdAt.toISOString()
            }
          : null
      });
    }
  }
  return tests;
}

async function loadTestsFromMemory(
  repo: RunsRepository,
  projectId: bigint,
  query: DefectSummaryQuery
): Promise<{ tests: DefectSummaryTestInput[]; scope: DefectSummaryScope }> {
  const runs = await repo.listRunsByProject(projectId);
  let filtered = runs;
  if (query.runId) {
    filtered = runs.filter((run) => run.id === query.runId);
  } else if (query.milestoneId) {
    filtered = runs.filter((run) => run.milestoneId === query.milestoneId);
  } else if (query.planId) {
    filtered = runs.filter((run) => run.planId === query.planId);
  }

  const scope: DefectSummaryScope = query.runId
    ? { type: "run", id: query.runId.toString(), label: filtered[0]?.name ?? `Run ${query.runId.toString()}` }
    : query.milestoneId
      ? { type: "milestone", id: query.milestoneId.toString(), label: `Milestone ${query.milestoneId.toString()}` }
      : query.planId
        ? { type: "plan", id: query.planId.toString(), label: `Plan ${query.planId.toString()}` }
        : { type: "project", id: null, label: "All runs" };

  const tests: DefectSummaryTestInput[] = [];
  for (const run of filtered) {
    const instances = await repo.listInstancesForRun(run.id);
    for (const instance of instances) {
      const results = await repo.listResultsForTestInstance(instance.id);
      const latest = latestByCreatedAt(results);
      tests.push({
        runId: run.id.toString(),
        runName: run.name,
        testId: instance.id.toString(),
        caseId: instance.caseId.toString(),
        title: instance.titleSnapshot,
        latestResult: latest
          ? {
              resultId: latest.id.toString(),
              status: latest.status,
              defectKeys: latest.defects ?? [],
              createdAt: latest.createdAt.toISOString()
            }
          : null
      });
    }
  }
  return { tests, scope };
}

export async function buildDefectSummaryReportForProject(
  projectId: bigint,
  deps: { prisma?: PrismaClient; repo?: RunsRepository },
  query: DefectSummaryQuery
) {
  if (deps.prisma) {
    const [scope, runIds] = await Promise.all([
      resolveScopeLabel(deps.prisma, projectId, query),
      resolveRunIds(deps.prisma, projectId, query)
    ]);
    const tests = await loadTestsFromPrisma(deps.prisma, projectId, runIds);
    return buildDefectSummaryReport(tests, scope);
  }

  if (!deps.repo) {
    return buildDefectSummaryReport([], { type: "project", id: null, label: "All runs" });
  }

  const { tests, scope } = await loadTestsFromMemory(deps.repo, projectId, query);
  return buildDefectSummaryReport(tests, scope);
}
