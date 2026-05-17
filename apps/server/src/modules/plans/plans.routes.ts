import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import {
  getAuthenticatedUser,
  requireProjectMutationRole
} from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import type { AuthService } from "../auth/auth.service.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { RunsService } from "../runs/runs.service.js";
import {
  buildPlanCreateData,
  buildPlanEntryCreateData,
  buildPlanEntryWriteData,
  buildPlanWriteData,
  createRunForPlanEntry,
  persistEntryConfigurations,
  toPlanDto,
  toPlanEntryDto,
  type MemoryPlanEntry,
  type MemoryPlanRow
} from "./plans.shared.js";
import { entryConfigurationsBodySchema, planBodySchema, planEntryBodySchema } from "./plans.schema.js";

type ConfigurationGroupRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  displayOrder: number;
};

type ConfigurationRow = {
  id: bigint;
  groupId: bigint;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

const plans: MemoryPlanRow[] = [];

export function listMemoryPlans(projectId: bigint) {
  return plans.filter((item) => item.projectId === projectId);
}

export function findMemoryPlan(projectId: bigint, planId: bigint) {
  return plans.find((item) => item.projectId === projectId && item.id === planId) ?? null;
}
const configurationGroups: ConfigurationGroupRow[] = [];
const configurations: ConfigurationRow[] = [];

const groupIdParamSchema = z.object({ groupId: z.coerce.bigint() });
const configurationIdParamSchema = z.object({ configurationId: z.coerce.bigint() });
const configurationGroupBodySchema = z.object({
  name: z.string().trim().min(1),
  displayOrder: z.coerce.number().int().optional()
});
const configurationBodySchema = z.object({
  name: z.string().trim().min(1),
  displayOrder: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional()
});
const matrixBodySchema = z.object({
  entryId: z.coerce.bigint().optional()
});
const runsByConfigurationBodySchema = z.object({
  entryId: z.coerce.bigint().optional(),
  configurationIds: z.array(z.coerce.bigint()).optional()
});

function validateOnePerGroup(
  selections: Array<{ configurationId: bigint; groupId: bigint }>
) {
  const seen = new Map<bigint, bigint>();
  for (const row of selections) {
    const existing = seen.get(row.groupId);
    if (existing && existing !== row.configurationId) {
      throw new AppError("VALIDATION_ERROR", "only one configuration per group can be selected", 400, {
        groupId: row.groupId.toString(),
        selected: [existing.toString(), row.configurationId.toString()]
      });
    }
    seen.set(row.groupId, row.configurationId);
  }
}

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
  deps: {
    prisma?: PrismaClient;
    authService: AuthService;
    runsService: RunsService;
    catalog: ProjectsRepository;
  }
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
            rows.map((row: (typeof rows)[number]) => toPlanDto(row)),
            1,
            100
          )
        )
      );
    }
    return reply.send(toJsonSafe(paged(plans.filter((p) => p.projectId === projectId), 1, 100)));
  });

  app.post("/api/projects/:projectId/plans", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = planBodySchema.parse(req.body ?? {});
    if (deps.prisma) {
      const created = await deps.prisma.testPlan.create({
        data: buildPlanCreateData(projectId, body)
      });
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "plan",
        entityId: created.id,
        eventType: "plan.created",
        title: "Test plan created",
        body: created.name,
        payload: { planId: created.id.toString(), name: created.name }
      });
      return reply.send(toJsonSafe({ data: toPlanDto(created) }));
    }
    const row: MemoryPlanRow = {
      id: BigInt(Date.now()),
      projectId,
      name: body.name?.trim() || "New test plan",
      assignedTo: body.assignedTo ?? null,
      refs: body.refs ?? null,
      startDate: body.startDate ?? null,
      dueOn: body.dueOn ?? null,
      entries: []
    };
    plans.unshift(row);
    return reply.send(toJsonSafe({ data: row }));
  });

  app.patch("/api/projects/:projectId/plans/:planId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);
    const body = planBodySchema.parse(req.body ?? {});
    if (deps.prisma) {
      const found = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true, name: true }
      });
      if (!found) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      const updated = await deps.prisma.testPlan.update({
        where: { id: planId },
        data: buildPlanWriteData(body)
      });
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "plan",
        entityId: updated.id,
        eventType: "plan.updated",
        title: "Test plan updated",
        body: updated.name,
        payload: {
          planId: updated.id.toString(),
          ...(body.name !== undefined ? { previousName: found.name, name: updated.name } : {})
        }
      });
      return reply.send(toJsonSafe({ data: toPlanDto(updated) }));
    }
    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    if (body.name !== undefined) row.name = body.name.trim() || "Untitled plan";
    if (body.assignedTo !== undefined) row.assignedTo = body.assignedTo;
    if (body.refs !== undefined) row.refs = body.refs;
    if (body.startDate !== undefined) row.startDate = body.startDate;
    if (body.dueOn !== undefined) row.dueOn = body.dueOn;
    return reply.send(toJsonSafe({ data: toPlanDto(row) }));
  });

  app.delete("/api/projects/:projectId/plans/:planId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);
    if (deps.prisma) {
      const found = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true, name: true }
      });
      if (!found) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      await deps.prisma.testPlan.update({
        where: { id: planId },
        data: { deletedAt: new Date() }
      });
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "plan",
        entityId: planId,
        eventType: "plan.deleted",
        title: "Test plan deleted",
        body: found.name,
        payload: { planId: planId.toString(), name: found.name }
      });
      return reply.status(204).send();
    }
    const index = plans.findIndex((item) => item.projectId === projectId && item.id === planId);
    if (index < 0) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    plans.splice(index, 1);
    return reply.status(204).send();
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
      return reply.send(toJsonSafe({ data: toPlanDto(found) }));
    }
    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    return reply.send(toJsonSafe({ data: toPlanDto(row) }));
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
            entries.map((entry: (typeof entries)[number]) => toPlanEntryDto(entry)),
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
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);
    const body = planEntryBodySchema.parse(req.body ?? {});
    if (deps.prisma) {
      const plan = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!plan) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      const created = await deps.prisma.testPlanEntry.create({
        data: buildPlanEntryCreateData(planId, body)
      });
      if (body.configurationIds?.length) {
        await persistEntryConfigurations(deps.prisma, projectId, created.id, body.configurationIds, validateOnePerGroup);
      }
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "plan_entry",
        entityId: created.id,
        eventType: "plan.entry_created",
        title: "Plan entry created",
        body: created.name,
        payload: {
          planId: planId.toString(),
          entryId: created.id.toString(),
          name: created.name,
          environment: created.environment ?? null
        }
      });
      return reply.send(toJsonSafe({ data: toPlanEntryDto(created) }));
    }
    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    const entry: MemoryPlanEntry = {
      id: BigInt(Date.now()),
      name: body.name?.trim() || "Entry",
      environment: body.environment?.trim() || undefined,
      suiteId: body.suiteId ?? undefined,
      assignedTo: body.assignedTo ?? null,
      refs: body.refs ?? null,
      startDate: body.startDate ?? null,
      dueOn: body.dueOn ?? null,
      includeAll: body.includeAll ?? true,
      includeCaseIds: body.includeCaseIds,
      excludeCaseIds: body.excludeCaseIds,
      isIncluded: body.isIncluded ?? true,
      configurationIds: body.configurationIds
    };
    row.entries.unshift(entry);
    return reply.send(toJsonSafe({ data: toPlanEntryDto(entry) }));
  });

  app.patch("/api/projects/:projectId/plans/:planId/entries/:entryId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string; entryId: string };
    const planId = BigInt(params.planId);
    const entryId = BigInt(params.entryId);
    const body = planEntryBodySchema.parse(req.body ?? {});
    if (deps.prisma) {
      const plan = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!plan) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      const found = await deps.prisma.testPlanEntry.findFirst({
        where: { id: entryId, planId, deletedAt: null },
        select: { id: true, name: true, environment: true }
      });
      if (!found) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
      }
      const updated = await deps.prisma.testPlanEntry.update({
        where: { id: entryId },
        data: buildPlanEntryWriteData(body)
      });
      if (body.configurationIds !== undefined) {
        await persistEntryConfigurations(
          deps.prisma,
          projectId,
          entryId,
          body.configurationIds,
          validateOnePerGroup
        );
      }
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "plan_entry",
        entityId: updated.id,
        eventType: "plan.entry_updated",
        title: "Plan entry updated",
        body: updated.name,
        payload: {
          planId: planId.toString(),
          entryId: updated.id.toString(),
          ...(body.name !== undefined ? { previousName: found.name, name: updated.name } : {}),
          ...(body.environment !== undefined
            ? { previousEnvironment: found.environment ?? null, environment: updated.environment ?? null }
            : {})
        }
      });
      return reply.send(toJsonSafe({ data: toPlanEntryDto(updated) }));
    }
    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    const entry = row.entries.find((item) => item.id === entryId);
    if (!entry) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
    }
    if (body.name !== undefined) entry.name = body.name.trim() || "Untitled entry";
    if (body.environment !== undefined) {
      entry.environment = body.environment === null ? undefined : body.environment.trim() || undefined;
    }
    if (body.suiteId !== undefined) entry.suiteId = body.suiteId ?? undefined;
    if (body.assignedTo !== undefined) entry.assignedTo = body.assignedTo;
    if (body.refs !== undefined) entry.refs = body.refs;
    if (body.startDate !== undefined) entry.startDate = body.startDate;
    if (body.dueOn !== undefined) entry.dueOn = body.dueOn;
    if (body.includeAll !== undefined) entry.includeAll = body.includeAll;
    if (body.includeCaseIds !== undefined) entry.includeCaseIds = body.includeCaseIds;
    if (body.excludeCaseIds !== undefined) entry.excludeCaseIds = body.excludeCaseIds;
    if (body.isIncluded !== undefined) entry.isIncluded = body.isIncluded;
    if (body.configurationIds !== undefined) entry.configurationIds = body.configurationIds;
    return reply.send(toJsonSafe({ data: toPlanEntryDto(entry) }));
  });

  app.put("/api/projects/:projectId/plans/:planId/entries/:entryId/configurations", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string; entryId: string };
    const planId = BigInt(params.planId);
    const entryId = BigInt(params.entryId);
    const { configurationIds } = entryConfigurationsBodySchema.parse(req.body ?? {});

    if (deps.prisma) {
      const entry = await deps.prisma.testPlanEntry.findFirst({
        where: { id: entryId, planId, deletedAt: null, plan: { projectId, deletedAt: null } },
        select: { id: true }
      });
      if (!entry) return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
      const saved = await persistEntryConfigurations(
        deps.prisma,
        projectId,
        entryId,
        configurationIds,
        validateOnePerGroup
      );
      return reply.send(toJsonSafe(ok({ entryId, configurationIds: saved.map((id) => id.toString()) })));
    }

    const plan = plans.find((p) => p.id === planId && p.projectId === projectId);
    if (!plan) return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    const target = plan.entries.find((e) => e.id === entryId);
    if (!target) return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
    if (configurationIds.length > 0) {
      const selectedConfigurations = configurations.filter(
        (c) => configurationIds.includes(c.id) && c.isActive && configurationGroups.some((g) => g.id === c.groupId && g.projectId === projectId)
      );
      if (selectedConfigurations.length !== configurationIds.length) {
        throw new AppError("VALIDATION_ERROR", "invalid configurationIds for this project", 400);
      }
      validateOnePerGroup(
        selectedConfigurations.map((c) => ({
          configurationId: c.id,
          groupId: c.groupId
        }))
      );
    }
    target.configurationIds = configurationIds;
    return reply.send(
      toJsonSafe(ok({ entryId, configurationIds: configurationIds.map((id) => id.toString()) }))
    );
  });

  app.delete("/api/projects/:projectId/plans/:planId/entries/:entryId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string; entryId: string };
    const planId = BigInt(params.planId);
    const entryId = BigInt(params.entryId);
    if (deps.prisma) {
      const plan = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!plan) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
      }
      const found = await deps.prisma.testPlanEntry.findFirst({
        where: { id: entryId, planId, deletedAt: null },
        select: { id: true, name: true }
      });
      if (!found) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
      }
      await deps.prisma.testPlanEntry.update({
        where: { id: entryId },
        data: { deletedAt: new Date() }
      });
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "plan_entry",
        entityId: entryId,
        eventType: "plan.entry_deleted",
        title: "Plan entry deleted",
        body: found.name,
        payload: { planId: planId.toString(), entryId: entryId.toString(), name: found.name }
      });
      return reply.status(204).send();
    }
    const row = plans.find((item) => item.projectId === projectId && item.id === planId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    }
    const index = row.entries.findIndex((item) => item.id === entryId);
    if (index < 0) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
    }
    row.entries.splice(index, 1);
    return reply.status(204).send();
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
        where: { id: planId, projectId, deletedAt: null }
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
        const { run } = await createRunForPlanEntry({
          runsService: deps.runsService,
          projectId,
          plan,
          entry: target,
          suiteId
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
        if (err instanceof AppError && (err.code === "NO_CASES_FOUND" || err.code === "VALIDATION_ERROR")) {
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
      const { run } = await createRunForPlanEntry({
        runsService: deps.runsService,
        projectId,
        plan: row,
        entry: target,
        suiteId
      });
      target.runId = run.id;
      return reply.send(toJsonSafe({ data: { planId, entryId: target.id, runId: run.id } }));
    } catch (err) {
      if (err instanceof AppError && (err.code === "NO_CASES_FOUND" || err.code === "VALIDATION_ERROR")) {
        return reply.status(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post("/api/projects/:projectId/plans/:planId/matrix", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);
    const { entryId } = matrixBodySchema.parse(req.body ?? {});

    if (deps.prisma) {
      const plan = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true, name: true }
      });
      if (!plan) return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });

      const entries = await deps.prisma.testPlanEntry.findMany({
        where: { planId, deletedAt: null },
        include: {
          configurations: {
            include: { configuration: true }
          }
        },
        orderBy: { id: "asc" }
      });
      const targetEntry = entryId !== undefined ? entries.find((e) => e.id === entryId) : entries[0];
      const groups = await deps.prisma.configurationGroup.findMany({
        where: { projectId, deletedAt: null },
        include: {
          configurations: {
            where: { deletedAt: null, isActive: true },
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
          }
        },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
      });

      return reply.send(
        toJsonSafe(
          ok({
            planId: plan.id,
            planName: plan.name,
            entryId: targetEntry?.id ?? null,
            selectedConfigurationIds: targetEntry?.configurations.map((c) => c.configurationId) ?? [],
            groups: groups.map((g) => ({
              id: g.id,
              name: g.name,
              displayOrder: g.displayOrder,
              configurations: g.configurations.map((c) => ({
                id: c.id,
                name: c.name,
                displayOrder: c.displayOrder
              }))
            }))
          })
        )
      );
    }

    const plan = plans.find((p) => p.id === planId && p.projectId === projectId);
    if (!plan) return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    const targetEntry = entryId !== undefined ? plan.entries.find((e) => e.id === entryId) : plan.entries[0];
    const groups = configurationGroups
      .filter((g) => g.projectId === projectId)
      .sort((a, b) => a.displayOrder - b.displayOrder || Number(a.id - b.id))
      .map((g) => ({
        id: g.id,
        name: g.name,
        displayOrder: g.displayOrder,
        configurations: configurations
          .filter((c) => c.groupId === g.id && c.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder || Number(a.id - b.id))
          .map((c) => ({ id: c.id, name: c.name, displayOrder: c.displayOrder }))
      }));
    return reply.send(
      toJsonSafe(
        ok({
          planId: plan.id,
          planName: plan.name,
          entryId: targetEntry?.id ?? null,
          selectedConfigurationIds: targetEntry?.configurationIds ?? [],
          groups
        })
      )
    );
  });

  app.post("/api/projects/:projectId/plans/:planId/runs/by-configuration", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);
    const { entryId, configurationIds } = runsByConfigurationBodySchema.parse(req.body ?? {});

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
        where: { id: planId, projectId, deletedAt: null }
      });
      if (!plan) return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });

      const target =
        entryId !== undefined
          ? await deps.prisma.testPlanEntry.findFirst({
              where: { id: entryId, planId, deletedAt: null }
            })
          : await deps.prisma.testPlanEntry.findFirst({
              where: { planId, deletedAt: null },
              orderBy: { id: "asc" }
            });
      if (!target) return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });

      const linkedConfigurations = configurationIds ?? [];
      const suiteId = await resolveSuiteId(target.suiteId);
      if (!suiteId) return reply.status(400).send({ error: "BAD_REQUEST", message: "no suite available for plan run" });

      const runId =
        target.runId ??
        (
          await createRunForPlanEntry({
            runsService: deps.runsService,
            projectId,
            plan,
            entry: target,
            suiteId
          })
        ).run.id;

      await deps.prisma.$transaction(async (tx) => {
        await tx.testPlanEntry.update({
          where: { id: target.id },
          data: { runId }
        });
        if (target.runId == null) {
          await tx.testRun.update({
            where: { id: runId },
            data: { planId }
          });
        }
      });
      if (linkedConfigurations.length > 0) {
        await persistEntryConfigurations(
          deps.prisma,
          projectId,
          target.id,
          linkedConfigurations,
          validateOnePerGroup
        );
      }

      return reply.send(
        toJsonSafe(
          ok({
            planId,
            entryId: target.id,
            runId,
            configurationIds: linkedConfigurations
          })
        )
      );
    }

    const plan = plans.find((p) => p.id === planId && p.projectId === projectId);
    if (!plan) return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    const target = entryId !== undefined ? plan.entries.find((e) => e.id === entryId) : plan.entries[0];
    if (!target) return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
    const linkedConfigurations = configurationIds ?? [];
    if (linkedConfigurations.length > 0) {
      const selectedConfigurations = configurations.filter(
        (c) => linkedConfigurations.includes(c.id) && c.isActive && configurationGroups.some((g) => g.id === c.groupId && g.projectId === projectId)
      );
      if (selectedConfigurations.length !== linkedConfigurations.length) {
        throw new AppError("VALIDATION_ERROR", "invalid configurationIds for this project", 400);
      }
      validateOnePerGroup(
        selectedConfigurations.map((c) => ({
          configurationId: c.id,
          groupId: c.groupId
        }))
      );
    }

    if (!target.runId) {
      const suiteId = await resolveSuiteId(target.suiteId);
      if (!suiteId) return reply.status(400).send({ error: "BAD_REQUEST", message: "no suite available for plan run" });
      target.runId = (
        await createRunForPlanEntry({
          runsService: deps.runsService,
          projectId,
          plan,
          entry: target,
          suiteId
        })
      ).run.id;
    }
    target.configurationIds = linkedConfigurations.length > 0 ? linkedConfigurations : target.configurationIds ?? [];
    return reply.send(
      toJsonSafe(
        ok({
          planId,
          entryId: target.id,
          runId: target.runId,
          configurationIds: target.configurationIds
        })
      )
    );
  });

  app.get("/api/projects/:projectId/plans/:planId/entries/:entryId/configurations", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string; entryId: string };
    const planId = BigInt(params.planId);
    const entryId = BigInt(params.entryId);

    if (deps.prisma) {
      const entry = await deps.prisma.testPlanEntry.findFirst({
        where: { id: entryId, planId, deletedAt: null, plan: { projectId, deletedAt: null } },
        include: {
          configurations: {
            include: { configuration: { include: { group: true } } }
          }
        }
      });
      if (!entry) return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
      return reply.send(
        toJsonSafe(
          ok({
            entryId: entry.id,
            configurationIds: entry.configurations.map((c) => c.configurationId),
            items: entry.configurations.map((c) => ({
              configurationId: c.configuration.id,
              configurationName: c.configuration.name,
              groupId: c.configuration.group.id,
              groupName: c.configuration.group.name
            }))
          })
        )
      );
    }

    const plan = plans.find((p) => p.id === planId && p.projectId === projectId);
    if (!plan) return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });
    const entry = plan.entries.find((e) => e.id === entryId);
    if (!entry) return reply.status(404).send({ error: "NOT_FOUND", message: "plan entry not found" });
    const ids = entry.configurationIds ?? [];
    return reply.send(
      toJsonSafe(
        ok({
          entryId: entry.id,
          configurationIds: ids,
          items: ids
            .map((id) => {
              const configuration = configurations.find((c) => c.id === id);
              if (!configuration) return null;
              const group = configurationGroups.find((g) => g.id === configuration.groupId);
              return {
                configurationId: configuration.id,
                configurationName: configuration.name,
                groupId: group?.id ?? null,
                groupName: group?.name ?? null
              };
            })
            .filter(Boolean)
        })
      )
    );
  });

  app.get("/api/projects/:projectId/plans/:planId/rollup-by-configuration", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const params = req.params as { planId: string };
    const planId = BigInt(params.planId);

    if (deps.prisma) {
      const plan = await deps.prisma.testPlan.findFirst({
        where: { id: planId, projectId, deletedAt: null },
        select: { id: true, name: true }
      });
      if (!plan) return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });

      const entries = await deps.prisma.testPlanEntry.findMany({
        where: { planId, deletedAt: null },
        include: {
          run: {
            select: {
              id: true,
              status: true,
              instances: {
                select: { status: true }
              }
            }
          },
          configurations: {
            include: {
              configuration: {
                include: { group: true }
              }
            }
          }
        }
      });

      const rollup = new Map<
        string,
        {
          configurationId: string;
          configurationName: string;
          groupId: string;
          groupName: string;
          entryCount: number;
          runCount: number;
          openRunCount: number;
          closedRunCount: number;
          passed: number;
          failed: number;
          blocked: number;
          retest: number;
          untested: number;
        }
      >();

      for (const entry of entries) {
        for (const map of entry.configurations) {
          const key = map.configurationId.toString();
          const cur = rollup.get(key) ?? {
            configurationId: map.configurationId.toString(),
            configurationName: map.configuration.name,
            groupId: map.configuration.groupId.toString(),
            groupName: map.configuration.group.name,
            entryCount: 0,
            runCount: 0,
            openRunCount: 0,
            closedRunCount: 0,
            passed: 0,
            failed: 0,
            blocked: 0,
            retest: 0,
            untested: 0
          };
          cur.entryCount += 1;
          if (entry.run) {
            cur.runCount += 1;
            if (entry.run.status === "open") cur.openRunCount += 1;
            if (entry.run.status === "closed") cur.closedRunCount += 1;
            for (const inst of entry.run.instances) {
              cur[inst.status] += 1;
            }
          }
          rollup.set(key, cur);
        }
      }

      return reply.send(
        toJsonSafe(
          ok({
            planId: plan.id,
            planName: plan.name,
            items: Array.from(rollup.values()).sort(
              (a, b) => a.groupName.localeCompare(b.groupName) || a.configurationName.localeCompare(b.configurationName)
            )
          })
        )
      );
    }

    const plan = plans.find((p) => p.id === planId && p.projectId === projectId);
    if (!plan) return reply.status(404).send({ error: "NOT_FOUND", message: "plan not found" });

    const rollup = new Map<
      string,
      {
        configurationId: string;
        configurationName: string;
        groupId: string;
        groupName: string;
        entryCount: number;
        runCount: number;
        openRunCount: number;
        closedRunCount: number;
        passed: number;
        failed: number;
        blocked: number;
        retest: number;
        untested: number;
      }
    >();

    for (const entry of plan.entries) {
      const ids = entry.configurationIds ?? [];
      for (const id of ids) {
        const cfg = configurations.find((c) => c.id === id);
        if (!cfg) continue;
        const grp = configurationGroups.find((g) => g.id === cfg.groupId);
        if (!grp) continue;
        const key = id.toString();
        const cur = rollup.get(key) ?? {
          configurationId: id.toString(),
          configurationName: cfg.name,
          groupId: grp.id.toString(),
          groupName: grp.name,
          entryCount: 0,
          runCount: 0,
          openRunCount: 0,
          closedRunCount: 0,
          passed: 0,
          failed: 0,
          blocked: 0,
          retest: 0,
          untested: 0
        };
        cur.entryCount += 1;
        if (entry.runId) {
          cur.runCount += 1;
          cur.openRunCount += 1;
        }
        rollup.set(key, cur);
      }
    }

    return reply.send(
      toJsonSafe(
        ok({
          planId: plan.id,
          planName: plan.name,
          items: Array.from(rollup.values()).sort(
            (a, b) => a.groupName.localeCompare(b.groupName) || a.configurationName.localeCompare(b.configurationName)
          )
        })
      )
    );
  });

  app.get("/api/projects/:projectId/configuration-groups", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.configurationGroup.findMany({
        where: { projectId, deletedAt: null },
        include: {
          configurations: {
            where: { deletedAt: null },
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
          }
        },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
      });
      return reply.send(
        toJsonSafe(
          paged(
            rows.map((row: (typeof rows)[number]) => ({
              id: row.id,
              projectId: row.projectId,
              name: row.name,
              displayOrder: row.displayOrder,
              configurations: row.configurations.map((c) => ({
                id: c.id,
                groupId: c.groupId,
                name: c.name,
                displayOrder: c.displayOrder,
                isActive: c.isActive
              }))
            })),
            1,
            100
          )
        )
      );
    }
    const groups = configurationGroups
      .filter((g) => g.projectId === projectId)
      .sort((a, b) => a.displayOrder - b.displayOrder || Number(a.id - b.id))
      .map((g) => ({
        ...g,
        configurations: configurations
          .filter((c) => c.groupId === g.id)
          .sort((a, b) => a.displayOrder - b.displayOrder || Number(a.id - b.id))
      }));
    return reply.send(toJsonSafe(paged(groups, 1, 100)));
  });

  app.post("/api/projects/:projectId/configuration-groups", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = configurationGroupBodySchema.parse(req.body ?? {});
    if (deps.prisma) {
      const created = await deps.prisma.configurationGroup.create({
        data: {
          projectId,
          name: body.name,
          displayOrder: body.displayOrder ?? 0
        }
      });
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "configuration_group",
        entityId: created.id,
        eventType: "configuration_group.created",
        title: "Configuration group created",
        body: created.name,
        payload: {
          configurationGroupId: created.id.toString(),
          name: created.name,
          displayOrder: created.displayOrder
        }
      });
      return reply.send(toJsonSafe({ data: created }));
    }
    const created: ConfigurationGroupRow = {
      id: BigInt(Date.now()),
      projectId,
      name: body.name,
      displayOrder: body.displayOrder ?? 0
    };
    configurationGroups.push(created);
    return reply.send(toJsonSafe({ data: created }));
  });

  app.patch("/api/configuration-groups/:groupId", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { groupId } = groupIdParamSchema.parse(req.params);
    const body = configurationGroupBodySchema.partial().parse(req.body ?? {});
    if (deps.prisma) {
      const found = await deps.prisma.configurationGroup.findFirst({
        where: { id: groupId, deletedAt: null },
        select: { id: true, projectId: true, name: true, displayOrder: true }
      });
      if (!found) return reply.status(404).send({ error: "NOT_FOUND", message: "configuration group not found" });
      const updated = await deps.prisma.configurationGroup.update({
        where: { id: groupId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {})
        }
      });
      await recordActivityEvent(deps.prisma, {
        projectId: found.projectId,
        actorUserId: user.id,
        entityType: "configuration_group",
        entityId: updated.id,
        eventType: "configuration_group.updated",
        title: "Configuration group updated",
        body: updated.name,
        payload: {
          configurationGroupId: updated.id.toString(),
          ...(body.name !== undefined ? { previousName: found.name, name: updated.name } : {}),
          ...(body.displayOrder !== undefined
            ? { previousDisplayOrder: found.displayOrder, displayOrder: updated.displayOrder }
            : {})
        }
      });
      return reply.send(toJsonSafe({ data: updated }));
    }
    const found = configurationGroups.find((g) => g.id === groupId);
    if (!found) return reply.status(404).send({ error: "NOT_FOUND", message: "configuration group not found" });
    if (body.name !== undefined) found.name = body.name;
    if (body.displayOrder !== undefined) found.displayOrder = body.displayOrder;
    return reply.send(toJsonSafe({ data: found }));
  });

  app.delete("/api/configuration-groups/:groupId", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { groupId } = groupIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const found = await deps.prisma.configurationGroup.findFirst({
        where: { id: groupId, deletedAt: null },
        select: { id: true, projectId: true, name: true }
      });
      if (!found) return reply.status(404).send({ error: "NOT_FOUND", message: "configuration group not found" });
      await deps.prisma.configurationGroup.update({
        where: { id: groupId },
        data: { deletedAt: new Date() }
      });
      await deps.prisma.configuration.updateMany({
        where: { groupId, deletedAt: null },
        data: { deletedAt: new Date() }
      });
      await recordActivityEvent(deps.prisma, {
        projectId: found.projectId,
        actorUserId: user.id,
        entityType: "configuration_group",
        entityId: groupId,
        eventType: "configuration_group.deleted",
        title: "Configuration group deleted",
        body: found.name,
        payload: { configurationGroupId: groupId.toString(), name: found.name }
      });
      return reply.status(204).send();
    }
    const before = configurationGroups.length;
    for (let i = configurationGroups.length - 1; i >= 0; i -= 1) {
      if (configurationGroups[i]!.id === groupId) configurationGroups.splice(i, 1);
    }
    for (let i = configurations.length - 1; i >= 0; i -= 1) {
      if (configurations[i]!.groupId === groupId) configurations.splice(i, 1);
    }
    if (before === configurationGroups.length) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "configuration group not found" });
    }
    return reply.status(204).send();
  });

  app.post("/api/configuration-groups/:groupId/configurations", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { groupId } = groupIdParamSchema.parse(req.params);
    const body = configurationBodySchema.parse(req.body ?? {});
    if (deps.prisma) {
      const group = await deps.prisma.configurationGroup.findFirst({
        where: { id: groupId, deletedAt: null },
        select: { id: true, projectId: true, name: true }
      });
      if (!group) return reply.status(404).send({ error: "NOT_FOUND", message: "configuration group not found" });
      const created = await deps.prisma.configuration.create({
        data: {
          groupId,
          name: body.name,
          displayOrder: body.displayOrder ?? 0,
          isActive: body.isActive ?? true
        }
      });
      await recordActivityEvent(deps.prisma, {
        projectId: group.projectId,
        actorUserId: user.id,
        entityType: "configuration",
        entityId: created.id,
        eventType: "configuration.created",
        title: "Configuration created",
        body: created.name,
        payload: {
          configurationId: created.id.toString(),
          configurationGroupId: groupId.toString(),
          groupName: group.name,
          name: created.name,
          isActive: created.isActive
        }
      });
      return reply.send(toJsonSafe({ data: created }));
    }
    const group = configurationGroups.find((g) => g.id === groupId);
    if (!group) return reply.status(404).send({ error: "NOT_FOUND", message: "configuration group not found" });
    const created: ConfigurationRow = {
      id: BigInt(Date.now()),
      groupId,
      name: body.name,
      displayOrder: body.displayOrder ?? 0,
      isActive: body.isActive ?? true
    };
    configurations.push(created);
    return reply.send(toJsonSafe({ data: created }));
  });

  app.patch("/api/configurations/:configurationId", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { configurationId } = configurationIdParamSchema.parse(req.params);
    const body = configurationBodySchema.partial().parse(req.body ?? {});
    if (deps.prisma) {
      const found = await deps.prisma.configuration.findFirst({
        where: { id: configurationId, deletedAt: null },
        select: {
          id: true,
          name: true,
          displayOrder: true,
          isActive: true,
          groupId: true,
          group: { select: { projectId: true } }
        }
      });
      if (!found) return reply.status(404).send({ error: "NOT_FOUND", message: "configuration not found" });
      const updated = await deps.prisma.configuration.update({
        where: { id: configurationId },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
        }
      });
      await recordActivityEvent(deps.prisma, {
        projectId: found.group.projectId,
        actorUserId: user.id,
        entityType: "configuration",
        entityId: updated.id,
        eventType: "configuration.updated",
        title: "Configuration updated",
        body: updated.name,
        payload: {
          configurationId: updated.id.toString(),
          configurationGroupId: found.groupId.toString(),
          ...(body.name !== undefined ? { previousName: found.name, name: updated.name } : {}),
          ...(body.displayOrder !== undefined
            ? { previousDisplayOrder: found.displayOrder, displayOrder: updated.displayOrder }
            : {}),
          ...(body.isActive !== undefined
            ? { previousIsActive: found.isActive, isActive: updated.isActive }
            : {})
        }
      });
      return reply.send(toJsonSafe({ data: updated }));
    }
    const found = configurations.find((c) => c.id === configurationId);
    if (!found) return reply.status(404).send({ error: "NOT_FOUND", message: "configuration not found" });
    if (body.name !== undefined) found.name = body.name;
    if (body.displayOrder !== undefined) found.displayOrder = body.displayOrder;
    if (body.isActive !== undefined) found.isActive = body.isActive;
    return reply.send(toJsonSafe({ data: found }));
  });

  app.delete("/api/configurations/:configurationId", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { configurationId } = configurationIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const found = await deps.prisma.configuration.findFirst({
        where: { id: configurationId, deletedAt: null },
        select: {
          id: true,
          name: true,
          groupId: true,
          group: { select: { projectId: true } }
        }
      });
      if (!found) return reply.status(404).send({ error: "NOT_FOUND", message: "configuration not found" });
      await deps.prisma.configuration.update({
        where: { id: configurationId },
        data: { deletedAt: new Date() }
      });
      await recordActivityEvent(deps.prisma, {
        projectId: found.group.projectId,
        actorUserId: user.id,
        entityType: "configuration",
        entityId: configurationId,
        eventType: "configuration.deleted",
        title: "Configuration deleted",
        body: found.name,
        payload: {
          configurationId: configurationId.toString(),
          configurationGroupId: found.groupId.toString(),
          name: found.name
        }
      });
      return reply.status(204).send();
    }
    const index = configurations.findIndex((c) => c.id === configurationId);
    if (index < 0) return reply.status(404).send({ error: "NOT_FOUND", message: "configuration not found" });
    configurations.splice(index, 1);
    return reply.status(204).send();
  });
}
