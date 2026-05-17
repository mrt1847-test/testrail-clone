import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  createMilestoneSchema,
  milestoneIdParamSchema,
  updateMilestoneSchema
} from "./milestones.schema.js";
import {
  parseOptionalDate,
  toMilestoneDto,
  validateMilestoneParent,
  type MilestoneRecord
} from "./milestones.shared.js";

const milestones: MilestoneRecord[] = [];
const milestoneRuns = new Map<bigint, Array<{ runId: bigint; runName: string; status: string; progress: number }>>();

export function listMemoryMilestones(projectId: bigint) {
  return milestones.filter((item) => item.projectId === projectId);
}

function findMemoryMilestone(projectId: bigint, milestoneId: bigint) {
  return milestones.find((item) => item.projectId === projectId && item.id === milestoneId) ?? null;
}

async function listProjectMilestoneParents(prisma: PrismaClient, projectId: bigint) {
  return prisma.milestone.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, parentMilestoneId: true }
  });
}

export async function registerMilestonesRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  app.get("/api/projects/:projectId/milestones", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.milestone.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ parentMilestoneId: "asc" }, { name: "asc" }],
        take: 250
      });
      return reply.send(toJsonSafe(paged(rows.map((row) => toMilestoneDto(row)), 1, 250)));
    }
    return reply.send(toJsonSafe(paged(listMemoryMilestones(projectId).map((row) => toMilestoneDto(row)), 1, 250)));
  });

  app.post("/api/projects/:projectId/milestones", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = createMilestoneSchema.parse(req.body ?? {});
    const parentMilestoneId = body.parentMilestoneId ?? null;
    const startDate = parseOptionalDate(body.startDate);
    const dueDate = parseOptionalDate(body.dueDate);

    if (deps.prisma) {
      const parentRows = await listProjectMilestoneParents(deps.prisma, projectId);
      validateMilestoneParent({ milestoneId: null, parentMilestoneId, rows: parentRows });
      const created = await deps.prisma.milestone.create({
        data: {
          projectId,
          name: body.name?.trim() || "New milestone",
          parentMilestoneId,
          ...(startDate !== undefined ? { startDate } : {}),
          ...(dueDate !== undefined ? { dueDate } : {})
        }
      });
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "milestone",
        entityId: created.id,
        eventType: "milestone.created",
        title: "Milestone created",
        body: created.name,
        payload: {
          milestoneId: created.id.toString(),
          name: created.name,
          ...(parentMilestoneId ? { parentMilestoneId: parentMilestoneId.toString() } : {})
        }
      });
      return reply.send(toJsonSafe({ data: toMilestoneDto(created) }));
    }

    const parentRows = listMemoryMilestones(projectId);
    validateMilestoneParent({ milestoneId: null, parentMilestoneId, rows: parentRows });
    const row: MilestoneRecord = {
      id: BigInt(Date.now()),
      projectId,
      parentMilestoneId,
      name: body.name?.trim() || "New milestone",
      startDate: startDate ?? null,
      dueDate: dueDate ?? null,
      isCompleted: false
    };
    milestones.unshift(row);
    return reply.send(toJsonSafe({ data: toMilestoneDto(row) }));
  });

  app.patch("/api/projects/:projectId/milestones/:milestoneId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { milestoneId } = milestoneIdParamSchema.parse(req.params);
    const body = updateMilestoneSchema.parse(req.body ?? {});

    if (deps.prisma) {
      const found = await deps.prisma.milestone.findFirst({
        where: { id: milestoneId, projectId, deletedAt: null }
      });
      if (!found) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
      }

      const parentRows = await listProjectMilestoneParents(deps.prisma, projectId);
      if (body.parentMilestoneId !== undefined) {
        validateMilestoneParent({
          milestoneId,
          parentMilestoneId: body.parentMilestoneId,
          rows: parentRows
        });
      }

      const startDate =
        body.startNow === true
          ? new Date()
          : body.startDate !== undefined
            ? parseOptionalDate(body.startDate)
            : undefined;
      const dueDate = body.dueDate !== undefined ? parseOptionalDate(body.dueDate) : undefined;

      const updated = await deps.prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() || "Untitled milestone" } : {}),
          ...(body.isCompleted !== undefined ? { isCompleted: body.isCompleted } : {}),
          ...(body.parentMilestoneId !== undefined ? { parentMilestoneId: body.parentMilestoneId } : {}),
          ...(startDate !== undefined ? { startDate } : {}),
          ...(dueDate !== undefined ? { dueDate } : {})
        }
      });

      const completionChanged = body.isCompleted !== undefined && found.isCompleted !== updated.isCompleted;
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "milestone",
        entityId: updated.id,
        eventType: completionChanged && updated.isCompleted ? "milestone.completed" : "milestone.updated",
        title: completionChanged && updated.isCompleted ? "Milestone completed" : "Milestone updated",
        body: updated.name,
        payload: {
          milestoneId: updated.id.toString(),
          ...(body.name !== undefined ? { previousName: found.name, name: updated.name } : {}),
          ...(body.isCompleted !== undefined
            ? { previousIsCompleted: found.isCompleted, isCompleted: updated.isCompleted }
            : {})
        }
      });
      return reply.send(toJsonSafe({ data: toMilestoneDto(updated) }));
    }

    const row = findMemoryMilestone(projectId, milestoneId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
    }
    if (body.parentMilestoneId !== undefined) {
      validateMilestoneParent({
        milestoneId,
        parentMilestoneId: body.parentMilestoneId,
        rows: listMemoryMilestones(projectId)
      });
      row.parentMilestoneId = body.parentMilestoneId;
    }
    if (body.name !== undefined) row.name = body.name.trim() || "Untitled milestone";
    if (body.isCompleted !== undefined) row.isCompleted = body.isCompleted;
    if (body.startNow === true) row.startDate = new Date();
    else if (body.startDate !== undefined) row.startDate = parseOptionalDate(body.startDate);
    if (body.dueDate !== undefined) row.dueDate = parseOptionalDate(body.dueDate);
    return reply.send(toJsonSafe({ data: toMilestoneDto(row) }));
  });

  app.delete("/api/projects/:projectId/milestones/:milestoneId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { milestoneId } = milestoneIdParamSchema.parse(req.params);

    if (deps.prisma) {
      const found = await deps.prisma.milestone.findFirst({
        where: { id: milestoneId, projectId, deletedAt: null },
        select: { id: true, name: true }
      });
      if (!found) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
      }
      await deps.prisma.milestone.update({
        where: { id: milestoneId },
        data: { deletedAt: new Date(), parentMilestoneId: null }
      });
      await deps.prisma.milestone.updateMany({
        where: { projectId, parentMilestoneId: milestoneId, deletedAt: null },
        data: { parentMilestoneId: null }
      });
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "milestone",
        entityId: milestoneId,
        eventType: "milestone.deleted",
        title: "Milestone deleted",
        body: found.name,
        payload: { milestoneId: milestoneId.toString(), name: found.name }
      });
      return reply.status(204).send();
    }

    const index = milestones.findIndex((item) => item.projectId === projectId && item.id === milestoneId);
    if (index < 0) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
    }
    for (const item of milestones) {
      if (item.projectId === projectId && item.parentMilestoneId === milestoneId) {
        item.parentMilestoneId = null;
      }
    }
    milestones.splice(index, 1);
    return reply.status(204).send();
  });

  app.get("/api/projects/:projectId/milestones/:milestoneId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { milestoneId } = milestoneIdParamSchema.parse(req.params);

    if (deps.prisma) {
      const found = await deps.prisma.milestone.findFirst({
        where: { id: milestoneId, projectId, deletedAt: null }
      });
      if (!found) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
      }
      const children = await deps.prisma.milestone.findMany({
        where: { projectId, parentMilestoneId: milestoneId, deletedAt: null },
        orderBy: { name: "asc" }
      });
      return reply.send(
        toJsonSafe({
          data: {
            ...toMilestoneDto(found),
            children: children.map((row) => toMilestoneDto(row))
          }
        })
      );
    }

    const row = findMemoryMilestone(projectId, milestoneId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
    }
    const children = listMemoryMilestones(projectId).filter((item) => item.parentMilestoneId === milestoneId);
    return reply.send(
      toJsonSafe({
        data: {
          ...toMilestoneDto(row),
          children: children.map((item) => toMilestoneDto(item))
        }
      })
    );
  });

  app.get("/api/projects/:projectId/milestones/:milestoneId/runs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { milestoneId } = milestoneIdParamSchema.parse(req.params);

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
            runs.map((item) => {
              const total = item.instances.length;
              const completed = item.instances.filter((instance) => instance.status !== "untested").length;
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

    const row = findMemoryMilestone(projectId, milestoneId);
    if (!row) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "milestone not found" });
    }
    const rows = milestoneRuns.get(milestoneId) ?? [];
    return reply.send(toJsonSafe(paged(rows, 1, 100)));
  });
}
