import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { AppError } from "../../common/errors/appError.js";
import type { ApiTokenScope } from "../../domain/apiTokenScopes.js";
import {
  assertApiTokenProject,
  assertApiTokenScopes,
  resolveProjectApiToken,
  touchApiTokenLastUsed,
  type ResolvedApiToken
} from "../tokens/apiToken.service.js";
import { resolveInMemoryApiToken } from "../tokens/tokens.routes.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { ResultsService } from "../results/results.service.js";
import type { RunsService } from "../runs/runs.service.js";
import { byCaseSchema, resultSchema } from "../results/results.schema.js";
import { runIdParamSchema, createRunSchema } from "../runs/runs.schema.js";

type UploadRow = {
  id: bigint;
  uploadedAt: string;
  total: number;
  saved: number;
  failed: number;
  ciProvider: string | null;
  branch: string | null;
  commitSha: string | null;
};

const uploadRows: UploadRow[] = [];

type AutomationMetadata = {
  external_run_id?: string | null;
  ci_provider?: string | null;
  ci_build_id?: string | null;
  job_url?: string | null;
  commit_sha?: string | null;
  branch?: string | null;
  attempt?: number | null;
};

const ciMetadataKeys = [
  "external_run_id",
  "ci_provider",
  "ci_build_id",
  "job_url",
  "commit_sha",
  "branch",
  "attempt"
] as const;

function normalizeResultAlias(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  return {
    ...row,
    caseId: row.caseId ?? row.case_id,
    testId: row.testId ?? row.test_id
  };
}

function normalizeAutomationBulkInput(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  const results = Array.isArray(row.results) ? row.results : [];
  return {
    ...row,
    results: results.map((item) => normalizeResultAlias(item))
  };
}

function toAutomationMetadata(value: unknown): AutomationMetadata | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const metadata: AutomationMetadata = {
    external_run_id: typeof row.external_run_id === "string" ? row.external_run_id : null,
    ci_provider: typeof row.ci_provider === "string" ? row.ci_provider : null,
    ci_build_id: typeof row.ci_build_id === "string" ? row.ci_build_id : null,
    job_url: typeof row.job_url === "string" ? row.job_url : null,
    commit_sha: typeof row.commit_sha === "string" ? row.commit_sha : null,
    branch: typeof row.branch === "string" ? row.branch : null,
    attempt: typeof row.attempt === "number" ? row.attempt : null
  };
  if (ciMetadataKeys.every((key) => metadata[key] == null)) {
    return undefined;
  }
  return metadata;
}

function mergeAutomationMetadata(
  base?: AutomationMetadata,
  overrides?: AutomationMetadata
): AutomationMetadata | undefined {
  if (!base && !overrides) return undefined;
  const merged: AutomationMetadata = {
    external_run_id: overrides?.external_run_id ?? base?.external_run_id ?? null,
    ci_provider: overrides?.ci_provider ?? base?.ci_provider ?? null,
    ci_build_id: overrides?.ci_build_id ?? base?.ci_build_id ?? null,
    job_url: overrides?.job_url ?? base?.job_url ?? null,
    commit_sha: overrides?.commit_sha ?? base?.commit_sha ?? null,
    branch: overrides?.branch ?? base?.branch ?? null,
    attempt: overrides?.attempt ?? base?.attempt ?? null
  };
  return merged;
}

function getBearerToken(value?: string): string | undefined {
  if (!value) return undefined;
  const [scheme, token] = value.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

async function requireAutomationToken(
  req: FastifyRequest,
  prisma: PrismaClient | undefined,
  requiredScopes: ApiTokenScope | ApiTokenScope[]
) {
  const authHeader = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const rawToken = getBearerToken(authHeader);
  if (!rawToken) {
    throw new AppError("UNAUTHORIZED", "missing automation token", 401);
  }

  if (!prisma) {
    const row = resolveInMemoryApiToken(rawToken);
    if (!row) {
      throw new AppError("UNAUTHORIZED", "invalid or expired automation token", 401);
    }
    assertApiTokenScopes(
      { id: row.id, projectId: row.projectId, userId: 1n, scopes: row.scopes, expiresAt: row.expiresAt ? new Date(row.expiresAt) : null },
      requiredScopes
    );
    row.lastUsedAt = new Date().toISOString();
    return {
      id: row.id,
      projectId: row.projectId,
      userId: 1n,
      scopes: row.scopes,
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : null
    } satisfies ResolvedApiToken;
  }

  const resolved = await resolveProjectApiToken(prisma, rawToken);
  if (!resolved) {
    throw new AppError("UNAUTHORIZED", "invalid or expired automation token", 401);
  }
  assertApiTokenScopes(resolved, requiredScopes);
  await touchApiTokenLastUsed(prisma, resolved.id);
  return resolved;
}

async function assertRunBelongsToProject(prisma: PrismaClient, runId: bigint, projectId: bigint) {
  const run = await prisma.testRun.findFirst({
    where: { id: runId, projectId, deletedAt: null },
    select: { id: true }
  });
  if (!run) {
    throw new AppError("NOT_FOUND", "run not found", 404);
  }
}

const automationBulkSchema = z.preprocess(
  normalizeAutomationBulkInput,
  z.object({
    runId: z.coerce.bigint(),
    atomic: z.boolean().optional(),
    results: z
      .array(z.object({ caseId: z.coerce.bigint().optional() }).merge(resultSchema))
      .refine((items) => items.every((item) => item.caseId !== undefined), {
        message: "caseId is required"
      })
  })
);

export async function registerAutomationRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; runsService: RunsService; resultsService: ResultsService }
) {
  const retryFailedForRun = async (projectId: bigint, uploadId: bigint) => {
    if (deps.prisma) {
      const rows = await deps.prisma.testResult.findMany({
        where: {
          source: "automation",
          status: "failed",
          instance: { runId: uploadId, run: { projectId, deletedAt: null } }
        },
        select: { id: true, testInstanceId: true },
        orderBy: { id: "desc" }
      });
      const deduped = new Map<bigint, bigint>();
      for (const row of rows) {
        if (!deduped.has(row.testInstanceId)) deduped.set(row.testInstanceId, row.id);
      }
      const targets = Array.from(deduped.keys());
      if (targets.length > 0) {
        await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.testResult.createMany({
            data: targets.map((testInstanceId) => ({
              testInstanceId,
              status: "retest",
              source: "api",
              comment: "Retry requested from automation upload detail"
            }))
          });
          await tx.testInstance.updateMany({
            where: { id: { in: targets } },
            data: { status: "retest" }
          });
        });
      }
      return { uploadId, queued: rows.length, retried: targets.length };
    }

    const row = uploadRows.find((item) => item.id === uploadId);
    if (!row) {
      throw new AppError("NOT_FOUND", "upload not found", 404);
    }
    return { uploadId, queued: row.failed, retried: row.failed };
  };

  app.get("/api/projects/:projectId/automation/summary", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const [mappedCases, uploadedRuns, latest] = await Promise.all([
        deps.prisma.testCase.count({
          where: { projectId, deletedAt: null, automationKey: { not: null } }
        }),
        deps.prisma.testResult.groupBy({
          by: ["testInstanceId"],
          where: { source: "automation", instance: { run: { projectId, deletedAt: null } } }
        }),
        deps.prisma.testResult.findFirst({
          where: { source: "automation", instance: { run: { projectId, deletedAt: null } } },
          orderBy: { id: "desc" },
          select: { createdAt: true }
        })
      ]);
      return reply.send(
        ok({
          mappedCases,
          uploadedRuns: uploadedRuns.length,
          lastUploadAt: latest?.createdAt.toISOString() ?? null
        })
      );
    }
    return reply.send(
      ok({
        mappedCases: 0,
        uploadedRuns: uploadRows.length,
        lastUploadAt: uploadRows[0]?.uploadedAt ?? null
      })
    );
  });

  app.get("/api/projects/:projectId/automation/mappings", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.testCase.findMany({
        where: { projectId, deletedAt: null, automationKey: { not: null } },
        select: { id: true, title: true, automationKey: true },
        orderBy: { id: "asc" },
        take: 100
      });
      return reply.send(
        toJsonSafe(
          paged(
            rows.map((row: (typeof rows)[number]) => ({
              caseId: row.id,
              title: row.title,
              automationKey: row.automationKey
            })),
            1,
            50
          )
        )
      );
    }
    return reply.send(paged([], 1, 50));
  });

  app.get("/api/projects/:projectId/automation/uploads", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.testResult.findMany({
        where: { source: "automation", instance: { run: { projectId, deletedAt: null } } },
        include: { instance: { include: { run: true } } },
        orderBy: { id: "desc" },
        take: 50
      });
      const grouped = new Map<bigint, UploadRow>();
      for (const row of rows) {
        const runId = row.instance.runId;
        const current = grouped.get(runId);
        if (!current) {
          const meta = toAutomationMetadata(row.metadata);
          grouped.set(runId, {
            id: runId,
            uploadedAt: row.createdAt.toISOString(),
            total: 1,
            saved: row.status === "failed" ? 0 : 1,
            failed: row.status === "failed" ? 1 : 0,
            ciProvider: meta?.ci_provider ?? null,
            branch: meta?.branch ?? null,
            commitSha: meta?.commit_sha ?? null
          });
        } else {
          current.total += 1;
          if (row.status === "failed") current.failed += 1;
          else current.saved += 1;
        }
      }
      return reply.send(toJsonSafe(paged(Array.from(grouped.values()), 1, 50)));
    }
    return reply.send(toJsonSafe(paged(uploadRows, 1, 50)));
  });

  app.get("/api/projects/:projectId/automation/uploads/:uploadId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { uploadId: string };
    const uploadId = BigInt(params.uploadId);
    if (deps.prisma) {
      const rows = await deps.prisma.testResult.findMany({
        where: { source: "automation", instance: { runId: uploadId, run: { projectId, deletedAt: null } } },
        include: { instance: true },
        orderBy: { id: "desc" }
      });
      if (rows.length === 0) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "upload not found" });
      }
      const failed = rows.filter((row: (typeof rows)[number]) => row.status === "failed").length;
      const latestMetadata = toAutomationMetadata(rows[0]?.metadata);
      return reply.send(
        ok({
          id: uploadId,
          uploadedAt: rows[0].createdAt.toISOString(),
          total: rows.length,
          saved: rows.length - failed,
          failed,
          items: rows.map((row: (typeof rows)[number]) => ({
            resultId: row.id,
            testId: row.testInstanceId,
            caseId: row.instance.caseId,
            status: row.status,
            comment: row.comment
          })),
          metadata: {
            external_run_id: latestMetadata?.external_run_id ?? uploadId.toString(),
            ci_provider: latestMetadata?.ci_provider ?? null,
            ci_build_id: latestMetadata?.ci_build_id ?? null,
            job_url: latestMetadata?.job_url ?? null,
            commit_sha: latestMetadata?.commit_sha ?? null,
            branch: latestMetadata?.branch ?? null,
            attempt: latestMetadata?.attempt ?? null
          }
        })
      );
    }
    const row = uploadRows.find((item) => item.id === uploadId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "upload not found" });
    }
    return reply.send(
      ok({
        ...row,
        items: [],
        metadata: {
          external_run_id: null,
          ci_provider: row.ciProvider,
          ci_build_id: null,
          job_url: null,
          commit_sha: row.commitSha,
          branch: row.branch,
          attempt: null
        }
      })
    );
  });

  app.post("/api/projects/:projectId/automation/uploads/:uploadId/retry-failed", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { uploadId: string };
    const uploadId = BigInt(params.uploadId);
    const retried = await retryFailedForRun(projectId, uploadId);
    return reply.send(ok(retried));
  });

  app.post("/api/automation/runs", async (req, reply) => {
    const ctx = await requireAutomationToken(req, deps.prisma, "automation:write");
    const body = createRunSchema.parse(req.body);
    assertApiTokenProject(ctx, body.projectId);
    const created = await deps.runsService.createRunWithInstances({
      projectId: ctx.projectId,
      suiteId: body.suiteId,
      milestoneId: body.milestoneId,
      name: body.name,
      environment: body.environment,
      includeAll: body.includeAll,
      caseIds: body.caseIds
    });
    return reply.send(toJsonSafe(created));
  });

  app.post("/api/automation/runs/:runId/results", async (req, reply) => {
    const ctx = await requireAutomationToken(req, deps.prisma, "automation:write");
    const { runId } = runIdParamSchema.parse(req.params);
    if (deps.prisma) {
      await assertRunBelongsToProject(deps.prisma, runId, ctx.projectId);
    }
    const body = byCaseSchema.parse(normalizeResultAlias(req.body));
    const metadata = toAutomationMetadata(req.body);
    const created = await deps.resultsService.addResultForCaseInRun(runId, body.caseId, {
      ...body,
      source: "automation",
      metadata
    });
    return reply.send(toJsonSafe(created));
  });

  app.post("/api/automation/results/bulk", async (req, reply) => {
    const ctx = await requireAutomationToken(req, deps.prisma, "automation:write");
    const body = automationBulkSchema.parse(req.body);
    const rawBody = normalizeAutomationBulkInput(req.body) as { results?: unknown[] } & Record<string, unknown>;
    const requestMetadata = toAutomationMetadata(rawBody);
    if (deps.prisma) {
      await assertRunBelongsToProject(deps.prisma, body.runId, ctx.projectId);
    }
    const res = await deps.resultsService.bulkAddResults({
      runId: body.runId,
      atomic: body.atomic,
      results: body.results.map((item, index) => ({
        ...item,
        source: "automation",
        metadata: mergeAutomationMetadata(requestMetadata, toAutomationMetadata(rawBody.results?.[index])),
        caseId: item.caseId as bigint
      }))
    });
    return reply.send(toJsonSafe(res));
  });

  app.post("/api/automation/uploads/:uploadId/retry", async (req, reply) => {
    const ctx = await requireAutomationToken(req, deps.prisma, "automation:write");
    const params = req.params as { uploadId: string };
    const uploadId = BigInt(params.uploadId);
    const retried = await retryFailedForRun(ctx.projectId, uploadId);
    return reply.send(ok(retried));
  });
}
