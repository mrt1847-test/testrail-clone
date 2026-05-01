import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { ok } from "../../common/utils/http.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { RunsRepository } from "../runs/runs.repository.js";

type ReportActivityItem = {
  runId: string;
  runName: string;
  caseId: string;
  title: string;
  status: string;
  source: string;
  createdAt: Date | string;
};

function toIsoDate(offsetDays: number) {
  const now = new Date();
  now.setDate(now.getDate() - offsetDays);
  return now.toISOString().slice(0, 10);
}

export async function registerReportsRoutes(
  app: FastifyInstance,
  deps: { repo: RunsRepository; prisma?: PrismaClient }
) {
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
    if (deps.prisma) {
      const [totalCases, activeRunsCount, recentFailures, mappedCases] = await Promise.all([
        deps.prisma.testCase.count({ where: { projectId, deletedAt: null } }),
        deps.prisma.testRun.count({ where: { projectId, status: "open", deletedAt: null } }),
        deps.prisma.testResult.count({
          where: {
            status: "failed",
            instance: { run: { projectId, deletedAt: null } }
          }
        }),
        deps.prisma.testCase.count({
          where: { projectId, deletedAt: null, automationKey: { not: null } }
        })
      ]);
      const automationCoveragePct = totalCases === 0 ? 0 : Math.round((mappedCases / totalCases) * 100);
      return reply.send(
        ok({
          totalCases,
          activeRuns: activeRunsCount,
          recentFailures,
          automationCoveragePct
        })
      );
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
    const counters = {
      passed: 0,
      failed: 0,
      blocked: 0,
      retest: 0,
      untested: 0
    };
    for (const run of runs) {
      const instances = await deps.repo.listInstancesForRun(run.id);
      for (const instance of instances) {
        counters[instance.status] += 1;
      }
    }

    return reply.send(
      ok(counters)
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
    return reply.send(ok({ points }));
  });

  app.get("/api/projects/:projectId/reports/automation-coverage", async (req, reply) => {
    projectIdParamSchema.parse(req.params);
    return reply.send(ok({ pct: 0 }));
  });

  app.get("/api/projects/:projectId/reports/recent-failures", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.testResult.findMany({
        where: { status: "failed", instance: { run: { projectId, deletedAt: null } } },
        orderBy: { id: "desc" },
        take: 10,
        include: { instance: { include: { run: true } } }
      });
      return reply.send(
        ok({
          items: rows.map((row: (typeof rows)[number]) => ({
            runId: row.instance.runId.toString(),
            runName: row.instance.run.name,
            caseId: row.instance.caseId.toString(),
            title: row.instance.titleSnapshot,
            status: row.status,
            source: row.source,
            createdAt: row.createdAt
          }))
        })
      );
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
    return reply.send(ok({ items: items.slice(0, 10) }));
  });

  app.get("/api/projects/:projectId/reports/recent-results", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.testResult.findMany({
        where: { instance: { run: { projectId, deletedAt: null } } },
        orderBy: { id: "desc" },
        take: 20,
        include: { instance: { include: { run: true } } }
      });
      return reply.send(
        ok({
          items: rows.map((row: (typeof rows)[number]) => ({
            runId: row.instance.runId.toString(),
            runName: row.instance.run.name,
            caseId: row.instance.caseId.toString(),
            title: row.instance.titleSnapshot,
            status: row.status,
            source: row.source,
            createdAt: row.createdAt
          }))
        })
      );
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
    return reply.send(ok({ items: items.slice(0, 20) }));
  });

  app.get("/api/projects/:projectId/reports/results-explorer", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const { runId, caseId, testId, status, source, createdFrom, createdTo, q } = resultExplorerQuerySchema.parse(req.query ?? {});

    if (deps.prisma) {
      const where = {
        ...(status ? { status } : {}),
        ...(source ? { source } : {}),
        ...(testId ? { testInstanceId: testId } : {}),
        ...((createdFrom || createdTo)
          ? {
              createdAt: {
                ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
                ...(createdTo ? { lte: new Date(createdTo) } : {})
              }
            }
          : {}),
        instance: {
          ...(runId ? { runId } : {}),
          ...(caseId ? { caseId } : {}),
          run: { projectId, deletedAt: null },
          ...(q
            ? {
                OR: [
                  { titleSnapshot: { contains: q, mode: "insensitive" as const } },
                  ...(q.match(/^c\d+$/i)
                    ? [{ caseId: BigInt(q.replace(/^c/i, "")) }]
                    : [])
                ]
              }
            : {})
        }
      };
      const [rows, total] = await deps.prisma.$transaction([
        deps.prisma.testResult.findMany({
          where,
          orderBy: { id: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { instance: { include: { run: true } } }
        }),
        deps.prisma.testResult.count({ where })
      ]);
      return reply.send(
        ok({
          items: rows.map((row: (typeof rows)[number]) => ({
            id: row.id.toString(),
            runId: row.instance.runId.toString(),
            runName: row.instance.run.name,
            testId: row.testInstanceId.toString(),
            caseId: row.instance.caseId.toString(),
            title: row.instance.titleSnapshot,
            status: row.status,
            source: row.source,
            createdAt: row.createdAt,
            comment: row.comment ?? null,
            customValues:
              row.customValues && typeof row.customValues === "object" && !Array.isArray(row.customValues)
                ? row.customValues
                : {}
          })),
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        })
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
      customValues?: Record<string, string | number | boolean | null>;
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
            customValues: row.customValues ?? {}
          });
        }
      }
    }
    const total = allItems.length;
    const start = (page - 1) * pageSize;
    const items = allItems.slice(start, start + pageSize);
    return reply.send(
      ok({
        items,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      })
    );
  });

  app.get("/api/projects/:projectId/reports/run-summary", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const runs = await deps.repo.listRunsByProject(projectId);
    const items = [];
    for (const run of runs) {
      const instances = await deps.repo.listInstancesForRun(run.id);
      const total = instances.length;
      const passed = instances.filter((item) => item.status === "passed").length;
      const failed = instances.filter((item) => item.status === "failed").length;
      const progress = total === 0 ? 0 : Math.round(((total - instances.filter((i) => i.status === "untested").length) / total) * 100);
      items.push({ runId: run.id.toString(), name: run.name, status: run.status, total, passed, failed, progress });
    }
    return reply.send(ok({ items }));
  });

  app.get("/api/projects/:projectId/reports/traceability", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.send(ok({ items: [] }));
    }

    const requirements = await deps.prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      include: {
        caseLinks: {
          include: {
            testCase: {
              select: {
                id: true,
                title: true,
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

    const items = requirements.flatMap((reqRow: (typeof requirements)[number]) =>
      reqRow.caseLinks.map((link: (typeof reqRow.caseLinks)[number]) => {
        const caseInstances = link.testCase.instances;
        const latest = caseInstances
          .map((inst) => ({
            runId: inst.run.id,
            runName: inst.run.name,
            testId: inst.id,
            result: inst.results[0]
          }))
          .filter((row) => row.result)
          .sort((a, b) => +b.result!.createdAt - +a.result!.createdAt)[0];

        return {
          requirementId: reqRow.id.toString(),
          requirementKey: reqRow.key,
          requirementTitle: reqRow.title,
          caseId: link.testCase.id.toString(),
          caseTitle: link.testCase.title,
          runId: latest?.runId?.toString() ?? null,
          runName: latest?.runName ?? null,
          testId: latest?.testId?.toString() ?? null,
          latestStatus: latest?.result?.status ?? "untested",
          latestResultAt: latest?.result?.createdAt ?? null,
          defects: latest?.result?.defectLinks.map((d) => d.defectKey) ?? []
        };
      })
    );

    return reply.send(ok({ items }));
  });

  app.get("/api/projects/:projectId/reports/coverage-gap", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.send(ok({ items: [] }));
    }

    const requirements = await deps.prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      include: {
        caseLinks: {
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

    const items = requirements.map((reqRow: (typeof requirements)[number]) => {
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

      const latestStatuses = reqRow.caseLinks.map((link: (typeof reqRow.caseLinks)[number]) => {
        const latest = link.testCase.instances
          .map((inst) => inst.results[0])
          .filter(Boolean)
          .sort((a, b) => +b!.createdAt - +a!.createdAt)[0];
        return latest?.status ?? "untested";
      });

      const hasAtRisk = latestStatuses.some((s) => s === "failed" || s === "blocked" || s === "retest");
      const hasTested = latestStatuses.some((s) => s === "passed");
      const coverageStatus = hasAtRisk ? "at_risk" : hasTested ? "covered" : "untested";

      return {
        requirementId: reqRow.id.toString(),
        requirementKey: reqRow.key,
        requirementTitle: reqRow.title,
        coverageStatus,
        linkedCaseCount: reqRow.caseLinks.length,
        latestStatuses
      };
    });

    return reply.send(ok({ items }));
  });

  app.get("/api/projects/:projectId/reports/defect-coverage", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.send(ok({ items: [] }));
    }

    const requirements = await deps.prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      include: {
        caseLinks: {
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

    const items = requirements.map((reqRow: (typeof requirements)[number]) => {
      const latestResults = reqRow.caseLinks
        .map((link: (typeof reqRow.caseLinks)[number]) => {
          const latest = link.testCase.instances
            .map((inst) => inst.results[0])
            .filter(Boolean)
            .sort((a, b) => +b!.createdAt - +a!.createdAt)[0];
          return latest ?? null;
        })
        .filter(Boolean);

      const atRiskResults = latestResults.filter(
        (r) => r.status === "failed" || r.status === "blocked" || r.status === "retest"
      );
      const defectKeys = Array.from(
        new Set(
          atRiskResults.flatMap((r) => {
            const normalized = r.defectLinks.map((d) => d.defectKey).filter((k) => k.trim().length > 0);
            return normalized;
          })
        )
      );

      return {
        requirementId: reqRow.id.toString(),
        requirementKey: reqRow.key,
        requirementTitle: reqRow.title,
        linkedCaseCount: reqRow.caseLinks.length,
        atRiskResultCount: atRiskResults.length,
        linkedDefectCount: defectKeys.length,
        defectKeys,
        defectCoverage: atRiskResults.length === 0 ? "not_applicable" : defectKeys.length > 0 ? "linked" : "unlinked"
      };
    });

    return reply.send(ok({ items }));
  });
}
