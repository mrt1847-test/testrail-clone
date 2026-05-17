import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { parseCaseRefs } from "../../domain/caseRefs.js";
import { customValuesFromJson, parseReportFilterValue, type CustomFieldValue } from "../../domain/customFieldTypes.js";
import { formatDurationSeconds, sumDurationSeconds } from "../../domain/timeTracking.js";
import {
  latestByCreatedAt,
  toCoverageStatus,
  toRunSummaryMetrics,
  toStatusCounters,
  toUniqueDefectKeys
} from "./reportMetrics.service.js";

type ReportActivityItem = {
  runId: string;
  runName: string;
  caseId: string;
  title: string;
  status: string;
  source: string;
  createdAt: Date | string;
};

type RunTimingSummary = {
  estimatedSeconds: number;
  actualSeconds: number;
  actualOverEstimateSeconds: number;
  estimate: string;
  actual: string;
  actualVsEstimate: string;
};

function buildRunTimingSummary(input: {
  estimates: Array<string | null | undefined>;
  elapsed: Array<string | null | undefined>;
}): RunTimingSummary {
  const estimatedSeconds = sumDurationSeconds(input.estimates);
  const actualSeconds = sumDurationSeconds(input.elapsed);
  const actualOverEstimateSeconds = actualSeconds - estimatedSeconds;
  return {
    estimatedSeconds,
    actualSeconds,
    actualOverEstimateSeconds,
    estimate: formatDurationSeconds(estimatedSeconds),
    actual: formatDurationSeconds(actualSeconds),
    actualVsEstimate:
      actualOverEstimateSeconds === 0
        ? ""
        : `${actualOverEstimateSeconds > 0 ? "+" : "-"}${formatDurationSeconds(Math.abs(actualOverEstimateSeconds))}`
  };
}

function toIsoDate(offsetDays: number) {
  const now = new Date();
  now.setDate(now.getDate() - offsetDays);
  return now.toISOString().slice(0, 10);
}

function extractCustomValueFilters(query: unknown) {
  if (!query || typeof query !== "object" || Array.isArray(query)) return [];
  return Object.entries(query as Record<string, unknown>)
    .filter(([key, value]) => key.startsWith("custom_") && typeof value === "string" && value.trim().length > 0)
    .map(([key, value]) => ({
      systemName: key.slice("custom_".length),
      rawValue: String(value).trim()
    }))
    .filter((item) => item.systemName.length > 0);
}

type ResultExplorerFilters = {
  runId?: bigint;
  caseId?: bigint;
  testId?: bigint;
  status?: "passed" | "failed" | "blocked" | "retest" | "untested";
  source?: "manual" | "automation" | "api";
  createdFrom?: string;
  createdTo?: string;
  q?: string;
  customFilters: Array<{ systemName: string; rawValue: string }>;
};

class ReportsQueryService {
  constructor(private readonly prisma?: PrismaClient) {}

  async getOverview(projectId: bigint) {
    if (!this.prisma) return null;
    const [totalCases, activeRuns, recentFailures, mappedCases] = await Promise.all([
      this.prisma.testCase.count({ where: { projectId, archivedAt: null, deletedAt: null } }),
      this.prisma.testRun.count({ where: { projectId, status: "open", deletedAt: null } }),
      this.prisma.testResult.count({
        where: {
          status: "failed",
          instance: { run: { projectId, deletedAt: null } }
        }
      }),
      this.prisma.testCase.count({
        where: { projectId, archivedAt: null, deletedAt: null, automationKey: { not: null } }
      })
    ]);
    const automationCoveragePct = totalCases === 0 ? 0 : Math.round((mappedCases / totalCases) * 100);
    return { totalCases, activeRuns, recentFailures, automationCoveragePct };
  }

  async listRecentFailures(projectId: bigint) {
    if (!this.prisma) return null;
    const rows = await this.prisma.testResult.findMany({
      where: { status: "failed", instance: { run: { projectId, deletedAt: null } } },
      orderBy: { id: "desc" },
      take: 10,
      include: { instance: { include: { run: true } } }
    });
    return rows.map((row) => ({
      runId: row.instance.runId.toString(),
      runName: row.instance.run.name,
      caseId: row.instance.caseId.toString(),
      title: row.instance.titleSnapshot,
      status: row.status,
      source: row.source,
      createdAt: row.createdAt
    }));
  }

  async listRecentResults(projectId: bigint) {
    if (!this.prisma) return null;
    const rows = await this.prisma.testResult.findMany({
      where: { instance: { run: { projectId, deletedAt: null } } },
      orderBy: { id: "desc" },
      take: 20,
      include: { instance: { include: { run: true } } }
    });
    return rows.map((row) => ({
      runId: row.instance.runId.toString(),
      runName: row.instance.run.name,
      caseId: row.instance.caseId.toString(),
      title: row.instance.titleSnapshot,
      status: row.status,
      source: row.source,
      createdAt: row.createdAt
    }));
  }

  async queryResultsExplorer(projectId: bigint, page: number, pageSize: number, filters: ResultExplorerFilters) {
    if (!this.prisma) return null;
    const customFields =
      filters.customFilters.length > 0
        ? await this.prisma.customField.findMany({
            where: {
              projectId,
              scope: "result",
              deletedAt: null,
              isActive: true,
              systemName: { in: filters.customFilters.map((filter) => filter.systemName) }
            },
            select: { systemName: true, fieldType: true }
          })
        : [];
    const customFieldByName = new Map(customFields.map((field) => [field.systemName, field]));
    const customWhere = filters.customFilters
      .map((filter): Prisma.TestResultWhereInput | null => {
        const field = customFieldByName.get(filter.systemName);
        if (!field) return null;
        return {
          customValues: {
            path: [filter.systemName],
            equals: parseReportFilterValue(filter.rawValue, field.fieldType)
          }
        };
      })
      .filter((item): item is Prisma.TestResultWhereInput => item !== null);
    const where: Prisma.TestResultWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.testId ? { testInstanceId: filters.testId } : {}),
      ...(customWhere.length > 0 ? { AND: customWhere } : {}),
      ...((filters.createdFrom || filters.createdTo)
        ? {
            createdAt: {
              ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}),
              ...(filters.createdTo ? { lte: new Date(filters.createdTo) } : {})
            }
          }
        : {}),
      instance: {
        ...(filters.runId ? { runId: filters.runId } : {}),
        ...(filters.caseId ? { caseId: filters.caseId } : {}),
        run: { projectId, deletedAt: null },
        ...(filters.q
          ? {
              OR: [
                { titleSnapshot: { contains: filters.q, mode: "insensitive" as const } },
                ...(filters.q.match(/^c\d+$/i) ? [{ caseId: BigInt(filters.q.replace(/^c/i, "")) }] : [])
              ]
            }
          : {})
      }
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.testResult.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { instance: { include: { run: true, testCase: { select: { refs: true } } } } }
      }),
      this.prisma.testResult.count({ where })
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id.toString(),
        runId: row.instance.runId.toString(),
        runName: row.instance.run.name,
        testId: row.testInstanceId.toString(),
        caseId: row.instance.caseId.toString(),
        title: row.instance.titleSnapshot,
        refs: row.instance.testCase.refs ?? null,
        status: row.status,
        source: row.source,
        createdAt: row.createdAt,
        comment: row.comment ?? null,
        customValues:
          row.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues)
            ? row.customValues
            : {}
      })),
      total
    };
  }

  async listTraceability(projectId: bigint) {
    if (!this.prisma) return null;
    const requirements = await this.prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      include: {
        caseLinks: {
          where: { testCase: { deletedAt: null, archivedAt: null } },
          include: {
            testCase: {
              select: {
                id: true,
                title: true,
                refs: true,
                instances: {
                  where: { run: { projectId, deletedAt: null } },
                  include: {
                    run: { select: { id: true, name: true } },
                    results: {
                      orderBy: { createdAt: "desc" },
                      take: 1,
                      include: { defectLinks: { where: { deletedAt: null }, select: { defectKey: true } } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    return requirements.flatMap((reqRow) =>
      reqRow.caseLinks.map((link) => {
        const caseInstances = link.testCase.instances;
        const latest = latestByCreatedAt(
          caseInstances
            .map((inst) => ({ runId: inst.run.id, runName: inst.run.name, testId: inst.id, result: inst.results[0] }))
            .filter((row) => row.result)
            .map((row) => ({ ...row, createdAt: row.result!.createdAt }))
        );
        return {
          requirementId: reqRow.id.toString(),
          requirementKey: reqRow.key,
          requirementTitle: reqRow.title,
          caseId: link.testCase.id.toString(),
          caseTitle: link.testCase.title,
          caseRefs: link.testCase.refs ?? null,
          runId: latest?.runId?.toString() ?? null,
          runName: latest?.runName ?? null,
          testId: latest?.testId?.toString() ?? null,
          latestStatus: latest?.result?.status ?? "untested",
          latestResultAt: latest?.result?.createdAt ?? null,
          defects: latest?.result?.defectLinks.map((d) => d.defectKey) ?? []
        };
      })
    );
  }

  async listRefsTraceability(projectId: bigint) {
    if (!this.prisma) return null;
    const cases = await this.prisma.testCase.findMany({
      where: {
        projectId,
        deletedAt: null,
        archivedAt: null,
        refs: { not: null }
      },
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        refs: true,
        instances: {
          where: { run: { projectId, deletedAt: null } },
          include: {
            run: { select: { id: true, name: true } },
            results: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { defectLinks: { where: { deletedAt: null }, select: { defectKey: true } } }
            }
          }
        }
      }
    });

    return cases.flatMap((testCase) => {
      const refKeys = parseCaseRefs(testCase.refs);
      if (refKeys.length === 0) return [];
      const latest = latestByCreatedAt(
        testCase.instances
          .map((inst) => ({
            runId: inst.run.id,
            runName: inst.run.name,
            testId: inst.id,
            result: inst.results[0]
          }))
          .filter((row) => row.result)
          .map((row) => ({ ...row, createdAt: row.result!.createdAt }))
      );
      return refKeys.map((refKey) => ({
        refKey,
        caseId: testCase.id.toString(),
        caseTitle: testCase.title,
        caseRefs: testCase.refs ?? null,
        runId: latest?.runId?.toString() ?? null,
        runName: latest?.runName ?? null,
        testId: latest?.testId?.toString() ?? null,
        latestStatus: latest?.result?.status ?? "untested",
        latestResultAt: latest?.result?.createdAt ?? null,
        defects: latest?.result?.defectLinks.map((d) => d.defectKey) ?? []
      }));
    });
  }

  async listCoverageGap(projectId: bigint) {
    if (!this.prisma) return null;
    const requirements = await this.prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      include: {
        caseLinks: {
          where: { testCase: { deletedAt: null, archivedAt: null } },
          include: {
            testCase: {
              select: {
                id: true,
                title: true,
                instances: {
                  where: { run: { projectId, deletedAt: null } },
                  include: {
                    results: {
                      orderBy: { createdAt: "desc" },
                      take: 1
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    return requirements.map((reqRow) => {
      if (reqRow.caseLinks.length === 0) {
        return {
          requirementId: reqRow.id.toString(),
          requirementKey: reqRow.key,
          requirementTitle: reqRow.title,
          coverageStatus: "uncovered",
          linkedCaseCount: 0,
          latestStatuses: []
        };
      }
      const latestStatuses = reqRow.caseLinks.map((link) =>
        latestByCreatedAt(link.testCase.instances.map((inst) => inst.results[0]))?.status ?? "untested"
      );
      const coverageStatus = toCoverageStatus(latestStatuses, reqRow.caseLinks.length);
      return {
        requirementId: reqRow.id.toString(),
        requirementKey: reqRow.key,
        requirementTitle: reqRow.title,
        coverageStatus,
        linkedCaseCount: reqRow.caseLinks.length,
        latestStatuses
      };
    });
  }

  async listDefectCoverage(projectId: bigint) {
    if (!this.prisma) return null;
    const requirements = await this.prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      include: {
        caseLinks: {
          where: { testCase: { deletedAt: null, archivedAt: null } },
          include: {
            testCase: {
              select: {
                id: true,
                instances: {
                  where: { run: { projectId, deletedAt: null } },
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
            }
          }
        }
      }
    });
    return requirements.map((reqRow) => {
      const latestResults = reqRow.caseLinks
        .map((link) => latestByCreatedAt(link.testCase.instances.map((inst) => inst.results[0])) ?? null)
        .filter(Boolean);
      const defectKeys = toUniqueDefectKeys(latestResults);
      const atRiskResultCount = latestResults.filter((result) => ["failed", "blocked", "retest"].includes(result.status)).length;
      return {
        requirementId: reqRow.id.toString(),
        requirementKey: reqRow.key,
        requirementTitle: reqRow.title,
        linkedCaseCount: reqRow.caseLinks.length,
        atRiskResultCount,
        linkedDefectCount: defectKeys.length,
        defectKeys,
        defectCoverage: atRiskResultCount === 0 ? "not_applicable" : defectKeys.length > 0 ? "linked" : "unlinked"
      };
    });
  }
}

async function buildMilestoneSummaryItems(
  projectId: bigint,
  deps: { repo: RunsRepository; prisma?: PrismaClient }
) {
  if (deps.prisma) {
    const milestones = await deps.prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ isCompleted: "asc" }, { id: "desc" }]
    });
    const items = [];
    for (const milestone of milestones) {
      const runs = await deps.prisma.testRun.findMany({
        where: { projectId, milestoneId: milestone.id, deletedAt: null },
        include: { instances: { where: { deletedAt: null }, select: { status: true } } }
      });
      const statuses = runs.flatMap((run) => run.instances.map((instance) => instance.status));
      const metrics = toRunSummaryMetrics(statuses);
      items.push({
        milestoneId: milestone.id.toString(),
        name: milestone.name,
        isCompleted: milestone.isCompleted,
        runCount: runs.length,
        openRunCount: runs.filter((run) => run.status === "open").length,
        total: metrics.total,
        passed: metrics.passed,
        failed: metrics.failed,
        progress: metrics.progress
      });
    }
    return items;
  }

  const runs = await deps.repo.listRunsByProject(projectId);
  const grouped = new Map<string, { name: string; isCompleted: boolean; statuses: string[]; runCount: number; openRunCount: number }>();
  for (const run of runs) {
    if (run.milestoneId == null) continue;
    const key = run.milestoneId.toString();
    const bucket = grouped.get(key) ?? {
      name: `Milestone ${key}`,
      isCompleted: false,
      statuses: [],
      runCount: 0,
      openRunCount: 0
    };
    bucket.runCount += 1;
    if (run.status === "open") bucket.openRunCount += 1;
    const instances = await deps.repo.listInstancesForRun(run.id);
    bucket.statuses.push(...instances.map((instance) => instance.status));
    grouped.set(key, bucket);
  }
  return Array.from(grouped.entries()).map(([milestoneId, bucket]) => {
    const metrics = toRunSummaryMetrics(bucket.statuses);
    return {
      milestoneId,
      name: bucket.name,
      isCompleted: bucket.isCompleted,
      runCount: bucket.runCount,
      openRunCount: bucket.openRunCount,
      total: metrics.total,
      passed: metrics.passed,
      failed: metrics.failed,
      progress: metrics.progress
    };
  });
}

async function buildPlanSummaryItems(projectId: bigint, deps: { repo: RunsRepository; prisma?: PrismaClient }) {
  if (deps.prisma) {
    const plans = await deps.prisma.testPlan.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ status: "asc" }, { id: "desc" }],
      include: {
        entries: {
          where: { deletedAt: null },
          include: {
            run: {
              include: { instances: { where: { deletedAt: null }, select: { status: true } } }
            }
          }
        },
        runs: {
          where: { deletedAt: null },
          include: { instances: { where: { deletedAt: null }, select: { status: true } } }
        }
      }
    });

    return plans.map((plan) => {
      const runMap = new Map<string, (typeof plan.runs)[number]>();
      for (const run of plan.runs) runMap.set(run.id.toString(), run);
      for (const entry of plan.entries) {
        if (entry.run) runMap.set(entry.run.id.toString(), entry.run);
      }
      const runs = Array.from(runMap.values());
      const metrics = toRunSummaryMetrics(runs.flatMap((run) => run.instances.map((instance) => instance.status)));
      return {
        planId: plan.id.toString(),
        name: plan.name,
        status: plan.status,
        entryCount: plan.entries.length,
        runCount: runs.length,
        openRunCount: runs.filter((run) => run.status === "open").length,
        total: metrics.total,
        passed: metrics.passed,
        failed: metrics.failed,
        progress: metrics.progress
      };
    });
  }

  return [];
}

async function buildInMemoryRefsTraceability(
  projectId: bigint,
  catalog: ProjectsRepository,
  runsRepo: RunsRepository
) {
  const cases = await catalog.listCases({ projectId, state: "active" });
  const runs = await runsRepo.listRunsByProject(projectId);
  const items: Array<{
    refKey: string;
    caseId: string;
    caseTitle: string;
    caseRefs: string | null;
    runId: string | null;
    runName: string | null;
    testId: string | null;
    latestStatus: string;
    latestResultAt: Date | null;
    defects: string[];
  }> = [];

  for (const testCase of cases) {
    const refKeys = parseCaseRefs(testCase.refs);
    if (refKeys.length === 0) continue;

    let latest:
      | {
          runId: bigint;
          runName: string;
          testId: bigint;
          status: string;
          createdAt: Date;
          defects: string[];
        }
      | undefined;

    for (const run of runs) {
      const instances = await runsRepo.listInstancesForRun(run.id);
      for (const instance of instances) {
        if (instance.caseId !== testCase.id) continue;
        const results = await runsRepo.listResultsForTestInstance(instance.id);
        const newest = results[0];
        if (!newest) continue;
        if (!latest || newest.createdAt > latest.createdAt) {
          latest = {
            runId: run.id,
            runName: run.name,
            testId: instance.id,
            status: newest.status,
            createdAt: newest.createdAt,
            defects: newest.defects ?? []
          };
        }
      }
    }

    for (const refKey of refKeys) {
      items.push({
        refKey,
        caseId: testCase.id.toString(),
        caseTitle: testCase.title,
        caseRefs: testCase.refs ?? null,
        runId: latest?.runId.toString() ?? null,
        runName: latest?.runName ?? null,
        testId: latest?.testId.toString() ?? null,
        latestStatus: latest?.status ?? "untested",
        latestResultAt: latest?.createdAt ?? null,
        defects: latest?.defects ?? []
      });
    }
  }

  return items;
}

export async function registerReportsRoutes(
  app: FastifyInstance,
  deps: { repo: RunsRepository; prisma?: PrismaClient; catalog?: ProjectsRepository }
) {
  const reportsQueryService = new ReportsQueryService(deps.prisma);
  const resultExplorerQuerySchema = z.object({
    runId: z.coerce.bigint().optional(),
    caseId: z.coerce.bigint().optional(),
    testId: z.coerce.bigint().optional(),
    status: z.enum(["passed", "failed", "blocked", "retest", "untested"]).optional(),
    source: z.enum(["manual", "automation", "api"]).optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    q: z.string().trim().min(1).optional()
  });
  app.get("/api/projects/:projectId/overview", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const runs = await deps.repo.listRunsByProject(projectId);
    const activeRuns = runs.filter((run) => run.status === "open").length;
    const overview = await reportsQueryService.getOverview(projectId);
    if (overview) {
      return reply.send(toJsonSafe(ok(overview)));
    }
    return reply.send(
      ok({
        totalCases: 0,
        activeRuns,
        recentFailures: 0,
        automationCoveragePct: 0
      })
    );
  });

  app.get("/api/projects/:projectId/reports/status-distribution", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const runs = await deps.repo.listRunsByProject(projectId);
    const statuses: string[] = [];
    for (const run of runs) {
      const instances = await deps.repo.listInstancesForRun(run.id);
      for (const instance of instances) {
        statuses.push(instance.status);
      }
    }

    return reply.send(
      ok(toStatusCounters(statuses))
    );
  });

  app.get("/api/projects/:projectId/reports/failure-trend", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const runs = await deps.repo.listRunsByProject(projectId);
    let failureCount = 0;
    for (const run of runs) {
      const instances = await deps.repo.listInstancesForRun(run.id);
      failureCount += instances.filter((instance) => instance.status === "failed").length;
    }
    const points = [
      { date: toIsoDate(6), failed: Math.max(0, failureCount - 2) },
      { date: toIsoDate(5), failed: Math.max(0, failureCount - 1) },
      { date: toIsoDate(4), failed: failureCount },
      { date: toIsoDate(3), failed: failureCount },
      { date: toIsoDate(2), failed: failureCount },
      { date: toIsoDate(1), failed: failureCount },
      { date: toIsoDate(0), failed: failureCount }
    ];
    return reply.send(toJsonSafe(ok({ points })));
  });

  app.get("/api/projects/:projectId/reports/automation-coverage", async (req, reply) => {
    projectIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok({ pct: 0 })));
  });

  app.get("/api/projects/:projectId/reports/recent-failures", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const prismaItems = await reportsQueryService.listRecentFailures(projectId);
    if (prismaItems) {
      return reply.send(toJsonSafe(ok({ items: prismaItems })));
    }
    const runs = await deps.repo.listRunsByProject(projectId);
    const items: ReportActivityItem[] = [];
    for (const run of runs) {
      const instances = await deps.repo.listInstancesForRun(run.id);
      for (const instance of instances) {
        if (instance.status === "failed") {
          items.push({
            runId: run.id.toString(),
            runName: run.name,
            caseId: instance.caseId.toString(),
            title: instance.titleSnapshot,
            status: instance.status,
            source: "manual",
            createdAt: new Date().toISOString()
          });
        }
      }
    }
    return reply.send(toJsonSafe(ok({ items: items.slice(0, 10) })));
  });

  app.get("/api/projects/:projectId/reports/recent-results", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const prismaItems = await reportsQueryService.listRecentResults(projectId);
    if (prismaItems) {
      return reply.send(toJsonSafe(ok({ items: prismaItems })));
    }
    const runs = await deps.repo.listRunsByProject(projectId);
    const items: ReportActivityItem[] = [];
    for (const run of runs) {
      const instances = await deps.repo.listInstancesForRun(run.id);
      for (const instance of instances) {
        items.push({
          runId: run.id.toString(),
          runName: run.name,
          caseId: instance.caseId.toString(),
          title: instance.titleSnapshot,
          status: instance.status,
          source: "manual",
          createdAt: new Date().toISOString()
        });
      }
    }
    return reply.send(toJsonSafe(ok({ items: items.slice(0, 20) })));
  });

  app.get("/api/projects/:projectId/reports/results-explorer", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const { runId, caseId, testId, status, source, createdFrom, createdTo, q } = resultExplorerQuerySchema.parse(req.query ?? {});
    const customFilters = extractCustomValueFilters(req.query);

    const prismaExplorer = await reportsQueryService.queryResultsExplorer(projectId, page, pageSize, {
      runId,
      caseId,
      testId,
      status,
      source,
      createdFrom,
      createdTo,
      q,
      customFilters
    });
    if (prismaExplorer) {
      return reply.send(
        toJsonSafe(ok({
          items: prismaExplorer.items,
          page,
          pageSize,
          total: prismaExplorer.total,
          totalPages: Math.max(1, Math.ceil(prismaExplorer.total / pageSize))
        }))
      );
    }

    const runs = await deps.repo.listRunsByProject(projectId);
    const runMap = new Map(runs.map((r) => [r.id, r]));
    const targetRuns = runId ? runs.filter((r) => r.id === runId) : runs;
    const allItems: Array<{
      id: string;
      runId: string;
      runName: string;
      testId: string;
      caseId: string;
      title: string;
      status: string;
      source: string;
      createdAt: string;
      comment: string | null;
      customValues?: Record<string, CustomFieldValue>;
    }> = [];
    for (const run of targetRuns) {
      const instances = await deps.repo.listInstancesForRun(run.id);
      for (const instance of instances) {
        if (caseId && instance.caseId !== caseId) continue;
        if (status && instance.status !== status) continue;
        if (q) {
          const query = q.toLowerCase();
          if (
            !instance.titleSnapshot.toLowerCase().includes(query) &&
            !`c${instance.caseId.toString()}`.toLowerCase().includes(query)
          ) {
            continue;
          }
        }
        const results = await deps.repo.listResultsForTestInstance(instance.id);
        for (const row of results) {
          if (source && row.source !== source) continue;
          if (testId && row.testInstanceId !== testId) continue;
          if (createdFrom && row.createdAt < new Date(createdFrom)) continue;
          if (createdTo && row.createdAt > new Date(createdTo)) continue;
          if (
            customFilters.some((filter) => {
              const value = row.customValues?.[filter.systemName];
              return value == null || String(value) !== filter.rawValue;
            })
          ) {
            continue;
          }
          allItems.push({
            id: row.id.toString(),
            runId: run.id.toString(),
            runName: runMap.get(run.id)?.name ?? run.name,
            testId: row.testInstanceId.toString(),
            caseId: instance.caseId.toString(),
            title: instance.titleSnapshot,
            status: row.status,
            source: row.source,
            createdAt: row.createdAt.toISOString(),
            comment: row.comment ?? null,
            customValues: customValuesFromJson(row.customValues)
          });
        }
      }
    }
    const total = allItems.length;
    const start = (page - 1) * pageSize;
    const items = allItems.slice(start, start + pageSize);
    return reply.send(
      toJsonSafe(ok({
        items,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }))
    );
  });

  app.get("/api/projects/:projectId/reports/run-summary", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const runs = await deps.repo.listRunsByProject(projectId);
    const items = [];
    for (const run of runs) {
      const instances = await deps.repo.listInstancesForRun(run.id);
      const metrics = toRunSummaryMetrics(instances.map((item) => item.status));
      const resultRows = await Promise.all(instances.map((instance) => deps.repo.listResultsForTestInstance(instance.id)));
      const timing = buildRunTimingSummary({
        estimates: instances.map((instance) => instance.estimateSnapshot),
        elapsed: resultRows.flat().map((result) => result.elapsed)
      });
      items.push({
        runId: run.id.toString(),
        name: run.name,
        status: run.status,
        total: metrics.total,
        passed: metrics.passed,
        failed: metrics.failed,
        progress: metrics.progress,
        ...timing
      });
    }
    return reply.send(toJsonSafe(ok({ items })));
  });

  app.get("/api/projects/:projectId/reports/traceability", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const items = await reportsQueryService.listTraceability(projectId);
    return reply.send(toJsonSafe(ok({ items: items ?? [] })));
  });

  app.get("/api/projects/:projectId/reports/refs-traceability", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const prismaItems = await reportsQueryService.listRefsTraceability(projectId);
    if (prismaItems) {
      return reply.send(toJsonSafe(ok({ items: prismaItems })));
    }
    if (deps.catalog) {
      const items = await buildInMemoryRefsTraceability(projectId, deps.catalog, deps.repo);
      return reply.send(toJsonSafe(ok({ items })));
    }
    return reply.send(toJsonSafe(ok({ items: [] })));
  });

  app.get("/api/projects/:projectId/reports/coverage-gap", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const items = await reportsQueryService.listCoverageGap(projectId);
    return reply.send(toJsonSafe(ok({ items: items ?? [] })));
  });

  app.get("/api/projects/:projectId/reports/defect-coverage", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const items = await reportsQueryService.listDefectCoverage(projectId);
    return reply.send(toJsonSafe(ok({ items: items ?? [] })));
  });

  app.get("/api/projects/:projectId/reports/milestone-summary", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const items = await buildMilestoneSummaryItems(projectId, deps);
    return reply.send(toJsonSafe(ok({ items })));
  });

  app.get("/api/projects/:projectId/reports/plan-summary", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const items = await buildPlanSummaryItems(projectId, deps);
    return reply.send(toJsonSafe(ok({ items })));
  });
}
