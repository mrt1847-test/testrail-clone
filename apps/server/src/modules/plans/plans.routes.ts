import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";

type PlanEntry = {
  id: bigint;
  name: string;
  environment?: string;
  runId?: bigint;
};

type PlanRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  entries: PlanEntry[];
};

const plans: PlanRow[] = [];

export async function registerPlansRoutes(app: FastifyInstance, deps: { prisma?: PrismaClient }) {
  app.get("/api/projects/:projectId/plans", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.testPlan.findMany({
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
              entries: []
            })),
            1,
            100
          )
        )
      );
    }
    return reply.send(toJsonSafe(paged(plans.filter((p) => p.projectId === projectId), 1, 100)));
  });

  app.post("/api/projects/:projectId/plans", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = req.body as { name?: string };
    if (deps.prisma) {
      const created = await deps.prisma.testPlan.create({
        data: {
          projectId,
          name: body.name?.trim() || "New test plan"
        }
      });
      return reply.send(
        toJsonSafe({
          data: { id: created.id, projectId: created.projectId, name: created.name, entries: [] }
        })
      );
    }
    const row: PlanRow = {
      id: BigInt(Date.now()),
      projectId,
      name: body.name?.trim() || "New test plan",
      entries: []
    };
    plans.unshift(row);
    return reply.send(toJsonSafe({ data: row }));
  });

  app.get("/api/projects/:projectId/plans/:planId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);
    if (deps.prisma) {
      const found = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null }
      });
      if (!found) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      return reply.send(
        toJsonSafe({
          data: { id: found.id, projectId: found.projectId, name: found.name, entries: [] }
        })
      );
    }
    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    return reply.send(toJsonSafe({ data: row }));
  });

  app.get("/api/projects/:projectId/plans/:planId/entries", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);
    if (deps.prisma) {
      const plan = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!plan) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      const entries = await deps.prisma.testPlanEntry.findMany({
        where: { planId, deletedAt: null },
        orderBy: { id: "desc" },
        take: 100
      });
      return reply.send(
        toJsonSafe(
          paged(
            entries.map((entry: (typeof entries)[number]) => ({
              id: entry.id,
              name: entry.name,
              environment: entry.environment ?? undefined,
              runId: entry.runId ?? undefined
            })),
            1,
            100
          )
        )
      );
    }
    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    return reply.send(toJsonSafe(paged(row.entries, 1, 100)));
  });

  app.post("/api/projects/:projectId/plans/:planId/entries", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);
    const body = req.body as { name?: string; environment?: string };
    if (deps.prisma) {
      const plan = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!plan) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      const created = await deps.prisma.testPlanEntry.create({
        data: {
          planId,
          name: body.name?.trim() || "Entry",
          environment: body.environment?.trim()
        }
      });
      return reply.send(
        toJsonSafe({
          data: {
            id: created.id,
            name: created.name,
            environment: created.environment ?? undefined,
            runId: created.runId ?? undefined
          }
        })
      );
    }
    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    const entry: PlanEntry = {
      id: BigInt(Date.now()),
      name: body.name?.trim() || "Entry",
      environment: body.environment?.trim()
    };
    row.entries.unshift(entry);
    return reply.send(toJsonSafe({ data: entry }));
  });

  app.post("/api/projects/:projectId/plans/:planId/runs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);
    if (deps.prisma) {
      const plan = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!plan) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      const body = req.body as { entryId?: string };
      const entryId = body.entryId ? BigInt(body.entryId) : undefined;
      const target =
        (entryId
          ? await deps.prisma.testPlanEntry.findFirst({
              where: { id: entryId, planId, deletedAt: null }
            })
          : await deps.prisma.testPlanEntry.findFirst({
              where: { planId, deletedAt: null },
              orderBy: { id: "asc" }
            })) ?? null;
      if (!target) {
        return reply.status(400).send({ error: "BAD_REQUEST", message: "no plan entry exists" });
      }
      const runId = target.runId ?? target.id;
      await deps.prisma.testPlanEntry.update({
        where: { id: target.id },
        data: { runId }
      });
      return reply.send(toJsonSafe({ data: { planId, entryId: target.id, runId } }));
    }
    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    const body = req.body as { entryId?: string };
    const entryId = body.entryId ? BigInt(body.entryId) : undefined;
    const target = row.entries.find((item) => item.id === entryId) ?? row.entries[0];
    if (!target) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "no plan entry exists" });
    }
    target.runId = BigInt(Date.now());
    return reply.send(toJsonSafe({ data: { planId, entryId: target.id, runId: target.runId } }));
  });
}
