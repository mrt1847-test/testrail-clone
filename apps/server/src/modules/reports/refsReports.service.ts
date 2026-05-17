import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { parseCaseRefs } from "../../domain/caseRefs.js";
import { buildRefsCoverageReport, type RefCaseLinkRow } from "../../domain/refsCoverage.js";
import { buildRefsComparisonReport, type RefRunStatusInput } from "../../domain/refsComparison.js";
import { buildRefsDefectSummaryReport, type RefDefectCaseRow } from "../../domain/refsDefectSummary.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { latestByCreatedAt } from "./reportMetrics.service.js";

export const refsComparisonQuerySchema = z
  .object({
    runIdA: z.coerce.bigint(),
    runIdB: z.coerce.bigint()
  })
  .refine((query) => query.runIdA !== query.runIdB, {
    message: "runIdA and runIdB must be different"
  });

async function loadRefCaseLinksFromPrisma(
  prisma: PrismaClient,
  projectId: bigint
): Promise<{ links: RefCaseLinkRow[]; casesWithRefs: number; casesWithoutRefs: number }> {
  const [cases, totalActive] = await Promise.all([
    prisma.testCase.findMany({
      where: { projectId, deletedAt: null, archivedAt: null },
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        refs: true,
        instances: {
          where: { deletedAt: null, run: { projectId, deletedAt: null } },
          include: {
            results: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } }
          }
        }
      }
    }),
    prisma.testCase.count({ where: { projectId, deletedAt: null, archivedAt: null } })
  ]);

  const links: RefCaseLinkRow[] = [];
  let casesWithRefs = 0;

  for (const testCase of cases) {
    const refKeys = parseCaseRefs(testCase.refs);
    if (refKeys.length === 0) continue;
    casesWithRefs += 1;
    const latestStatus =
      latestByCreatedAt(
        testCase.instances
          .map((inst) => inst.results[0])
          .filter(Boolean)
          .map((result) => ({ ...result!, createdAt: result!.createdAt }))
      )?.status ?? "untested";

    for (const refKey of refKeys) {
      links.push({
        refKey,
        caseId: testCase.id.toString(),
        caseTitle: testCase.title,
        latestStatus
      });
    }
  }

  return {
    links,
    casesWithRefs,
    casesWithoutRefs: totalActive - casesWithRefs
  };
}

async function loadRefCaseLinksFromMemory(
  catalog: ProjectsRepository,
  runsRepo: RunsRepository,
  projectId: bigint
) {
  const cases = await catalog.listCases({ projectId, state: "active" });
  const runs = await runsRepo.listRunsByProject(projectId);
  const links: RefCaseLinkRow[] = [];
  let casesWithRefs = 0;

  for (const testCase of cases) {
    const refKeys = parseCaseRefs(testCase.refs);
    if (refKeys.length === 0) continue;
    casesWithRefs += 1;

    let latestStatus = "untested";
    let latestAt: Date | null = null;
    for (const run of runs) {
      const instances = await runsRepo.listInstancesForRun(run.id);
      for (const instance of instances) {
        if (instance.caseId !== testCase.id) continue;
        const results = await runsRepo.listResultsForTestInstance(instance.id);
        const newest = results[0];
        if (newest && (!latestAt || newest.createdAt > latestAt)) {
          latestAt = newest.createdAt;
          latestStatus = newest.status;
        } else if (!newest) {
          latestStatus = instance.status;
        }
      }
    }

    for (const refKey of refKeys) {
      links.push({
        refKey,
        caseId: testCase.id.toString(),
        caseTitle: testCase.title,
        latestStatus
      });
    }
  }

  return {
    links,
    casesWithRefs,
    casesWithoutRefs: cases.length - casesWithRefs
  };
}

async function loadRefRunStatusInputsFromPrisma(
  prisma: PrismaClient,
  projectId: bigint,
  runIdA: bigint,
  runIdB: bigint
): Promise<{
  runA: { runId: string; name: string };
  runB: { runId: string; name: string };
  inputs: RefRunStatusInput[];
}> {
  const [runA, runB, cases] = await Promise.all([
    prisma.testRun.findFirst({
      where: { id: runIdA, projectId, deletedAt: null },
      select: { id: true, name: true }
    }),
    prisma.testRun.findFirst({
      where: { id: runIdB, projectId, deletedAt: null },
      select: { id: true, name: true }
    }),
    prisma.testCase.findMany({
      where: { projectId, deletedAt: null, archivedAt: null, refs: { not: null } },
      select: {
        id: true,
        title: true,
        refs: true,
        instances: {
          where: { deletedAt: null, runId: { in: [runIdA, runIdB] } },
          select: { id: true, runId: true, status: true }
        }
      }
    })
  ]);

  const inputs: RefRunStatusInput[] = [];
  for (const testCase of cases) {
    const refKeys = parseCaseRefs(testCase.refs);
    if (refKeys.length === 0) continue;
    const instA = testCase.instances.find((row) => row.runId === runIdA);
    const instB = testCase.instances.find((row) => row.runId === runIdB);
    for (const refKey of refKeys) {
      inputs.push({
        refKey,
        caseId: testCase.id.toString(),
        caseTitle: testCase.title,
        statusA: instA?.status ?? null,
        statusB: instB?.status ?? null,
        testIdA: instA?.id.toString() ?? null,
        testIdB: instB?.id.toString() ?? null
      });
    }
  }

  return {
    runA: { runId: runIdA.toString(), name: runA?.name ?? `Run ${runIdA.toString()}` },
    runB: { runId: runIdB.toString(), name: runB?.name ?? `Run ${runIdB.toString()}` },
    inputs
  };
}

async function loadRefRunStatusInputsFromMemory(
  catalog: ProjectsRepository,
  runsRepo: RunsRepository,
  projectId: bigint,
  runIdA: bigint,
  runIdB: bigint
) {
  const runs = await runsRepo.listRunsByProject(projectId);
  const runA = runs.find((row) => row.id === runIdA);
  const runB = runs.find((row) => row.id === runIdB);
  const cases = await catalog.listCases({ projectId, state: "active" });
  const inputs: RefRunStatusInput[] = [];

  const instancesA = runA ? await runsRepo.listInstancesForRun(runA.id) : [];
  const instancesB = runB ? await runsRepo.listInstancesForRun(runB.id) : [];
  const mapA = new Map(instancesA.map((row) => [row.caseId.toString(), row]));
  const mapB = new Map(instancesB.map((row) => [row.caseId.toString(), row]));

  for (const testCase of cases) {
    const refKeys = parseCaseRefs(testCase.refs);
    if (refKeys.length === 0) continue;
    const caseId = testCase.id.toString();
    const instA = mapA.get(caseId);
    const instB = mapB.get(caseId);
    for (const refKey of refKeys) {
      inputs.push({
        refKey,
        caseId,
        caseTitle: testCase.title,
        statusA: instA?.status ?? null,
        statusB: instB?.status ?? null,
        testIdA: instA?.id.toString() ?? null,
        testIdB: instB?.id.toString() ?? null
      });
    }
  }

  return {
    runA: { runId: runIdA.toString(), name: runA?.name ?? `Run ${runIdA.toString()}` },
    runB: { runId: runIdB.toString(), name: runB?.name ?? `Run ${runIdB.toString()}` },
    inputs
  };
}

function mergeDefectKeys(defectLinks: Array<{ defectKey: string }>, defects: string[]) {
  const keys = new Set<string>();
  for (const link of defectLinks) {
    const normalized = link.defectKey.trim();
    if (normalized.length > 0) keys.add(normalized);
  }
  for (const key of defects) {
    const normalized = key.trim();
    if (normalized.length > 0) keys.add(normalized);
  }
  return [...keys];
}

async function loadRefDefectCaseRowsFromPrisma(prisma: PrismaClient, projectId: bigint): Promise<RefDefectCaseRow[]> {
  const cases = await prisma.testCase.findMany({
    where: { projectId, deletedAt: null, archivedAt: null, refs: { not: null } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      refs: true,
      instances: {
        where: { deletedAt: null, run: { projectId, deletedAt: null } },
        include: {
          results: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              status: true,
              createdAt: true,
              defects: true,
              defectLinks: { where: { deletedAt: null }, select: { defectKey: true } }
            }
          }
        }
      }
    }
  });

  const rows: RefDefectCaseRow[] = [];
  for (const testCase of cases) {
    const refKeys = parseCaseRefs(testCase.refs);
    if (refKeys.length === 0) continue;

    const latest = latestByCreatedAt(
      testCase.instances
        .map((inst) => inst.results[0])
        .filter(Boolean)
        .map((result) => ({ ...result!, createdAt: result!.createdAt }))
    );
    const latestStatus = latest?.status ?? "untested";
    const defectKeys = latest
      ? mergeDefectKeys(latest.defectLinks ?? [], latest.defects ?? [])
      : [];

    for (const refKey of refKeys) {
      rows.push({
        refKey,
        caseId: testCase.id.toString(),
        caseTitle: testCase.title,
        latestStatus,
        defectKeys
      });
    }
  }
  return rows;
}

async function loadRefDefectCaseRowsFromMemory(
  catalog: ProjectsRepository,
  runsRepo: RunsRepository,
  projectId: bigint
): Promise<RefDefectCaseRow[]> {
  const cases = await catalog.listCases({ projectId, state: "active" });
  const runs = await runsRepo.listRunsByProject(projectId);
  const rows: RefDefectCaseRow[] = [];

  for (const testCase of cases) {
    const refKeys = parseCaseRefs(testCase.refs);
    if (refKeys.length === 0) continue;

    let latestStatus = "untested";
    let defectKeys: string[] = [];
    let latestAt: Date | null = null;

    for (const run of runs) {
      const instances = await runsRepo.listInstancesForRun(run.id);
      for (const instance of instances) {
        if (instance.caseId !== testCase.id) continue;
        const results = await runsRepo.listResultsForTestInstance(instance.id);
        const newest = results[0];
        if (newest && (!latestAt || newest.createdAt > latestAt)) {
          latestAt = newest.createdAt;
          latestStatus = newest.status;
          defectKeys = newest.defects ?? [];
        } else if (!newest) {
          latestStatus = instance.status;
          defectKeys = [];
        }
      }
    }

    for (const refKey of refKeys) {
      rows.push({
        refKey,
        caseId: testCase.id.toString(),
        caseTitle: testCase.title,
        latestStatus,
        defectKeys
      });
    }
  }
  return rows;
}

export async function buildRefsDefectSummaryReportForProject(
  projectId: bigint,
  deps: { prisma?: PrismaClient; catalog?: ProjectsRepository; repo?: RunsRepository }
) {
  if (deps.prisma) {
    return buildRefsDefectSummaryReport(await loadRefDefectCaseRowsFromPrisma(deps.prisma, projectId));
  }
  if (deps.catalog && deps.repo) {
    return buildRefsDefectSummaryReport(await loadRefDefectCaseRowsFromMemory(deps.catalog, deps.repo, projectId));
  }
  return buildRefsDefectSummaryReport([]);
}

export async function buildRefsCoverageReportForProject(
  projectId: bigint,
  deps: { prisma?: PrismaClient; catalog?: ProjectsRepository; repo?: RunsRepository }
) {
  if (deps.prisma) {
    const payload = await loadRefCaseLinksFromPrisma(deps.prisma, projectId);
    return buildRefsCoverageReport(payload.links, {
      casesWithRefs: payload.casesWithRefs,
      casesWithoutRefs: payload.casesWithoutRefs
    });
  }
  if (deps.catalog && deps.repo) {
    const payload = await loadRefCaseLinksFromMemory(deps.catalog, deps.repo, projectId);
    return buildRefsCoverageReport(payload.links, {
      casesWithRefs: payload.casesWithRefs,
      casesWithoutRefs: payload.casesWithoutRefs
    });
  }
  return buildRefsCoverageReport([], { casesWithRefs: 0, casesWithoutRefs: 0 });
}

export async function buildRefsComparisonReportForProject(
  projectId: bigint,
  deps: { prisma?: PrismaClient; catalog?: ProjectsRepository; repo?: RunsRepository },
  query: z.infer<typeof refsComparisonQuerySchema>
) {
  if (deps.prisma) {
    const payload = await loadRefRunStatusInputsFromPrisma(deps.prisma, projectId, query.runIdA, query.runIdB);
    return buildRefsComparisonReport(payload.runA, payload.runB, payload.inputs);
  }
  if (deps.catalog && deps.repo) {
    const payload = await loadRefRunStatusInputsFromMemory(
      deps.catalog,
      deps.repo,
      projectId,
      query.runIdA,
      query.runIdB
    );
    return buildRefsComparisonReport(payload.runA, payload.runB, payload.inputs);
  }
  return buildRefsComparisonReport(
    { runId: query.runIdA.toString(), name: `Run ${query.runIdA.toString()}` },
    { runId: query.runIdB.toString(), name: `Run ${query.runIdB.toString()}` },
    []
  );
}
