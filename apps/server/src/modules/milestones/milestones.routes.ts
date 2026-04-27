import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";

type MilestoneRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  isCompleted: boolean;
};

const milestones: MilestoneRow[] = [];
const milestoneRuns = new Map<bigint, Array<{ runId: bigint; runName: string; status: string; progress: number }>>();

export async function registerMilestonesRoutes(app: FastifyInstance, deps: { prisma?: PrismaClient }) {
  app.get("/api/projects/:projectId/milestones", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.milestone.findMany({
        where: { projectId, deletedAt: null },
        orderBy: { id: "desc" },
        take: 100
      });
      return reply.send(
        toJsonSafe(
          paged(
            rows.map((row: (typeof rows)[number]) => ({
              id: row.id,
              projectId: row.projectId,
              name: row.name,
              isCompleted: row.isCompleted
            })),
            1,
            100
          )
        )
      );
    }
    const rows = milestones.filter((item) => item.projectId === projectId);
    return reply.send(toJsonSafe(paged(rows, 1, 100)));
  });

  app.post("/api/projects/:projectId/milestones", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = req.body as { name?: string };
    if (deps.prisma) {
      const created = await deps.prisma.milestone.create({
        data: {
          projectId,
          name: body.name?.trim() || "New milestone"
        }
      });
      return reply.send(
        toJsonSafe({
          data: {
            id: created.id,
            projectId: created.projectId,
            name: created.name,
            isCompleted: created.isCompleted
          }
        })
      );
    }
    const row: MilestoneRow = {
      id: BigInt(Date.now()),
      projectId,
      name: body.name?.trim() || "New milestone",
      isCompleted: false
    };
    milestones.unshift(row);
    return reply.send(toJsonSafe({ data: row }));
  });

  app.get("/api/projects/:projectId/milestones/:milestoneId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { milestoneId: string };
    const milestoneId = BigInt(params.milestoneId);
    if (deps.prisma) {
      const found = await deps.prisma.milestone.findFirst({
        where: { id: milestoneId, projectId, deletedAt: null }
      });
      if (!found) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
      }
      return reply.send(
        toJsonSafe({
          data: {
            id: found.id,
            projectId: found.projectId,
            name: found.name,
            isCompleted: found.isCompleted
          }
        })
      );
    }
    const row = milestones.find((item) => item.projectId === projectId && item.id === milestoneId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
    }
    return reply.send(toJsonSafe({ data: row }));
  });

  app.get("/api/projects/:projectId/milestones/:milestoneId/runs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { milestoneId: string };
    const milestoneId = BigInt(params.milestoneId);
    if (deps.prisma) {
      const row = await deps.prisma.milestone.findFirst({
        where: { id: milestoneId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!row) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
      }
      const runs = await deps.prisma.testRun.findMany({
        where: { projectId, milestoneId, deletedAt: null },
        orderBy: { id: "desc" },
        include: { instances: true }
      });
      return reply.send(
        toJsonSafe(
          paged(
            runs.map((item: (typeof runs)[number]) => {
              const total = item.instances.length;
              const completed = item.instances.filter((instance: (typeof item.instances)[number]) => instance.status !== "untested").length;
              return {
                runId: item.id,
                runName: item.name,
                status: item.status,
                progress: total === 0 ? 0 : Math.round((completed / total) * 100)
              };
            }),
            1,
            100
          )
        )
      );
    }
    const row = milestones.find((item) => item.projectId === projectId && item.id === milestoneId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
    }
    const rows = milestoneRuns.get(milestoneId) ?? [];
    return reply.send(toJsonSafe(paged(rows, 1, 100)));
  });
}
