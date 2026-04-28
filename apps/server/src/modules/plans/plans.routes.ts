import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";
import { paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { RunsService } from "../runs/runs.service.js";

type PlanEntry = {
  id: bigint;
  name: string;
  environment?: string;
  suiteId?: bigint;
  runId?: bigint;
};

type PlanRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  entries: PlanEntry[];
};

const plans: PlanRow[] = [];

function parseOptionalEntryId(raw: unknown): bigint | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "bigint") return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  try {
    return BigInt(s);
  } catch {
    throw new AppError("VALIDATION_ERROR", "invalid entryId", 400);
  }
}

export async function registerPlansRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; runsService: RunsService; catalog: ProjectsRepository }
) {
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
    const body = (req.body ?? {}) as { entryId?: unknown };
    let entryId: bigint | undefined;
    try {
      entryId = parseOptionalEntryId(body.entryId);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }

    async function resolveSuiteId(targetSuiteId: bigint | null | undefined): Promise<bigint | null> {
      if (targetSuiteId != null) {
        const suite = await deps.catalog.getSuite(targetSuiteId);
        if (!suite || suite.projectId !== projectId) return null;
        return suite.id;
      }
      const suites = await deps.catalog.listSuitesByProject(projectId);
      return suites[0]?.id ?? null;
    }

    if (deps.prisma) {
      const plan = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true, name: true, milestoneId: true }
      });
      if (!plan) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      const target =
        entryId !== undefined
          ? await deps.prisma.testPlanEntry.findFirst({
              where: { id: entryId, planId, deletedAt: null }
            })
          : await deps.prisma.testPlanEntry.findFirst({
              where: { planId, deletedAt: null },
              orderBy: { id: "asc" }
            });
      if (!target) {
        if (entryId !== undefined) {
          return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
        }
        return reply.status(400).send({ error: "BAD_REQUEST", message: "no plan entry exists" });
      }
      if (target.runId) {
        return reply.send(toJsonSafe({ data: { planId, entryId: target.id, runId: target.runId } }));
      }
      const suiteId = await resolveSuiteId(target.suiteId);
      if (!suiteId) {
        return reply.status(400).send({ error: "BAD_REQUEST", message: "no suite available for plan run" });
      }
      try {
        const { run } = await deps.runsService.createRunWithInstances({
          projectId,
          suiteId,
          milestoneId: plan.milestoneId ?? null,
          name: `${plan.name} — ${target.name}`,
          includeAll: true,
          environment: target.environment?.trim() ?? null
        });
        await deps.prisma.$transaction([
          deps.prisma.testPlanEntry.update({
            where: { id: target.id },
            data: { runId: run.id }
          }),
          deps.prisma.testRun.update({
            where: { id: run.id },
            data: { planId }
          })
        ]);
        return reply.send(toJsonSafe({ data: { planId, entryId: target.id, runId: run.id } }));
      } catch (err) {
        if (err instanceof AppError && err.code === "NO_CASES_FOUND") {
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    }

    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    const target =
      entryId !== undefined ? row.entries.find((item) => item.id === entryId) ?? null : row.entries[0] ?? null;
    if (!target) {
      if (entryId !== undefined) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
      }
      return reply.status(400).send({ error: "BAD_REQUEST", message: "no plan entry exists" });
    }
    if (target.runId) {
      return reply.send(toJsonSafe({ data: { planId, entryId: target.id, runId: target.runId } }));
    }
    const suiteId = await resolveSuiteId(target.suiteId);
    if (!suiteId) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "no suite available for plan run" });
    }
    try {
      const { run } = await deps.runsService.createRunWithInstances({
        projectId,
        suiteId,
        milestoneId: null,
        name: `${row.name} — ${target.name}`,
        includeAll: true,
        environment: target.environment?.trim() ?? null
      });
      target.runId = run.id;
      return reply.send(toJsonSafe({ data: { planId, entryId: target.id, runId: run.id } }));
    } catch (err) {
      if (err instanceof AppError && err.code === "NO_CASES_FOUND") {
        return reply.status(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
}
