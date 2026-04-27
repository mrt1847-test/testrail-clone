import type { FastifyInstance } from "fastify";
import type { PrismaClient, Prisma } from "@prisma/client";

import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";

type UploadRow = {
  id: bigint;
  uploadedAt: string;
  total: number;
  saved: number;
  failed: number;
  ciProvider?: string;
  branch?: string;
  commitSha?: string;
};

const uploadRows: UploadRow[] = [];

export async function registerAutomationRoutes(app: FastifyInstance, deps: { prisma?: PrismaClient }) {
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
          grouped.set(runId, {
            id: runId,
            uploadedAt: row.createdAt.toISOString(),
            total: 1,
            saved: row.status === "failed" ? 0 : 1,
            failed: row.status === "failed" ? 1 : 0
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
            external_run_id: uploadId.toString(),
            ci_provider: null,
            ci_build_id: null,
            job_url: null,
            commit_sha: null,
            branch: null,
            attempt: null
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
          ci_provider: row.ciProvider ?? null,
          ci_build_id: null,
          job_url: null,
          commit_sha: row.commitSha ?? null,
          branch: row.branch ?? null,
          attempt: null
        }
      })
    );
  });

  app.post("/api/projects/:projectId/automation/uploads/:uploadId/retry-failed", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { uploadId: string };
    const uploadId = BigInt(params.uploadId);
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
      return reply.send(ok({ uploadId, queued: rows.length, retried: targets.length }));
    }
    const row = uploadRows.find((item) => item.id === uploadId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "upload not found" });
    }
    return reply.send(ok({ uploadId, queued: row.failed, retried: row.failed }));
  });
}
