import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  customStatuses,
  customStatusCreateSchema,
  customStatusUpdateSchema,
  customStatusIdParamSchema,
  type CustomStatusRow,
  normalizeSystemName,
  statusToResponse,
  statusAuditChanges,
  defaultStatusRows,
  type SettingsRouteDeps
} from "./settings.shared.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import { MAX_PROJECT_CUSTOM_STATUSES, resolveStatusFlags } from "../../domain/customStatusPolicy.js";
import { AppError } from "../../common/errors/appError.js";

export async function registerStatusesRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/statuses", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.customStatus.findMany({
        where: { projectId, deletedAt: null, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
      });
      const items = rows.length > 0 ? rows.map(statusToResponse) : defaultStatusRows(projectId).map(statusToResponse);
      return reply.send(toJsonSafe(ok(items)));
    }
    const rows = customStatuses.filter((item) => item.projectId === projectId && item.isActive);
    const items = rows.length > 0 ? rows : defaultStatusRows(projectId);
    return reply.send(toJsonSafe(ok(items)));
  });

  app.get("/api/projects/:projectId/settings/statuses", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.customStatus.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
      });
      const items = rows.length > 0 ? rows.map(statusToResponse) : defaultStatusRows(projectId).map(statusToResponse);
      return reply.send(toJsonSafe(paged(items, 1, 100)));
    }
    const rows = customStatuses.filter((item) => item.projectId === projectId);
    return reply.send(toJsonSafe(paged(rows.length > 0 ? rows : defaultStatusRows(projectId), 1, 100)));
  });

  app.post("/api/projects/:projectId/settings/statuses", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = customStatusCreateSchema.parse(req.body);
    const systemName = normalizeSystemName(body.systemName ?? body.name);
    if (!systemName) {
      return reply.code(400).send({ code: "INVALID_CUSTOM_STATUS", message: "systemName must contain a letter or number" });
    }
    const flags = resolveStatusFlags(body.canonicalStatus, {
      isFinal: body.isFinal,
      isUntested: body.isUntested
    });
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const row = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const customCount = await tx.customStatus.count({
            where: { projectId, isSystem: false, deletedAt: null }
          });
          if (customCount >= MAX_PROJECT_CUSTOM_STATUSES) {
            throw new AppError(
              "CUSTOM_STATUS_LIMIT",
              `projects may define at most ${MAX_PROJECT_CUSTOM_STATUSES} custom statuses`,
              400
            );
          }
          const created = await tx.customStatus.create({
            data: {
              projectId,
              name: body.name,
              systemName,
              canonicalStatus: body.canonicalStatus,
              color: body.color,
              isFinal: flags.isFinal,
              isUntested: flags.isUntested,
              isSystem: false,
              isActive: body.isActive,
              displayOrder: body.displayOrder,
              createdBy: actor.id,
              updatedBy: actor.id
            }
          });
          await tx.auditLog.create({
            data: {
              projectId,
              actorUserId: actor.id,
              action: "settings.custom_status.created",
              entityType: "custom_status",
              entityId: created.id.toString(),
              changes: statusAuditChanges(statusToResponse(created))
            }
          });
          return created;
        });
        await recordActivityEvent(deps.prisma, {
          projectId,
          actorUserId: actor.id,
          entityType: "custom_status",
          entityId: row.id,
          eventType: "settings.custom_status.created",
          title: "Custom status created",
          body: row.name,
          payload: { systemName: row.systemName, canonicalStatus: row.canonicalStatus }
        });
        return reply.send(toJsonSafe(ok(statusToResponse(row))));
      } catch (e) {
        if (e instanceof Error && e.message.includes("Unique constraint")) {
          return reply.code(409).send({ code: "CUSTOM_STATUS_EXISTS", message: "custom status systemName already exists" });
        }
        throw e;
      }
    }
    if (customStatuses.some((item) => item.projectId === projectId && item.systemName === systemName)) {
      return reply.code(409).send({ code: "CUSTOM_STATUS_EXISTS", message: "custom status systemName already exists" });
    }
    const customCount = customStatuses.filter((item) => item.projectId === projectId && !item.isSystem).length;
    if (customCount >= MAX_PROJECT_CUSTOM_STATUSES) {
      return reply
        .code(400)
        .send({ code: "CUSTOM_STATUS_LIMIT", message: `projects may define at most ${MAX_PROJECT_CUSTOM_STATUSES} custom statuses` });
    }
    const row: CustomStatusRow = {
      id: BigInt(Date.now()),
      projectId,
      name: body.name,
      systemName,
      canonicalStatus: body.canonicalStatus,
      color: body.color,
      isFinal: flags.isFinal,
      isUntested: flags.isUntested,
      isSystem: false,
      isActive: body.isActive,
      displayOrder: body.displayOrder
    };
    customStatuses.push(row);
    return reply.send(toJsonSafe(ok(row)));
  });

  app.patch("/api/projects/:projectId/settings/statuses/:statusId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, statusId } = customStatusIdParamSchema.parse(req.params);
    const body = customStatusUpdateSchema.parse(req.body);
    const nextSystemName = body.systemName !== undefined ? normalizeSystemName(body.systemName) : undefined;
    if (body.systemName !== undefined && !nextSystemName) {
      return reply.code(400).send({ code: "INVALID_CUSTOM_STATUS", message: "systemName must contain a letter or number" });
    }
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const row = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existing = await tx.customStatus.findFirst({
            where: { id: statusId, projectId, deletedAt: null },
            select: { id: true }
          });
          if (!existing) {
            throw new Error("CUSTOM_STATUS_NOT_FOUND");
          }
          const current = await tx.customStatus.findFirst({
            where: { id: existing.id },
            select: { canonicalStatus: true, isFinal: true, isUntested: true }
          });
          const nextCanonical = (body.canonicalStatus ?? current?.canonicalStatus ?? "untested") as CustomStatusRow["canonicalStatus"];
          const nextFlags = resolveStatusFlags(nextCanonical, {
            isFinal: body.isFinal ?? current?.isFinal,
            isUntested: body.isUntested ?? current?.isUntested
          });
          const updated = await tx.customStatus.update({
            where: { id: existing.id },
            data: {
              ...(body.name !== undefined ? { name: body.name } : {}),
              ...(nextSystemName !== undefined ? { systemName: nextSystemName } : {}),
              ...(body.canonicalStatus !== undefined ? { canonicalStatus: body.canonicalStatus } : {}),
              ...(body.color !== undefined ? { color: body.color } : {}),
              ...(body.isFinal !== undefined || body.canonicalStatus !== undefined
                ? { isFinal: nextFlags.isFinal }
                : {}),
              ...(body.isUntested !== undefined || body.canonicalStatus !== undefined
                ? { isUntested: nextFlags.isUntested }
                : {}),
              ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
              ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
              updatedBy: actor.id
            }
          });
          await tx.auditLog.create({
            data: {
              projectId,
              actorUserId: actor.id,
              action: "settings.custom_status.updated",
              entityType: "custom_status",
              entityId: updated.id.toString(),
              changes: statusAuditChanges(statusToResponse(updated))
            }
          });
          return updated;
        });
        await recordActivityEvent(deps.prisma, {
          projectId,
          actorUserId: actor.id,
          entityType: "custom_status",
          entityId: row.id,
          eventType: "settings.custom_status.updated",
          title: "Custom status updated",
          body: row.name,
          payload: { systemName: row.systemName, canonicalStatus: row.canonicalStatus }
        });
        return reply.send(toJsonSafe(ok(statusToResponse(row))));
      } catch (e) {
        if (e instanceof Error && e.message === "CUSTOM_STATUS_NOT_FOUND") {
          return reply.code(404).send({ code: "NOT_FOUND", message: "custom status not found" });
        }
        if (e instanceof Error && e.message.includes("Unique constraint")) {
          return reply.code(409).send({ code: "CUSTOM_STATUS_EXISTS", message: "custom status systemName already exists" });
        }
        throw e;
      }
    }
    const row = customStatuses.find((item) => item.projectId === projectId && item.id === statusId);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "custom status not found" });
    if (
      nextSystemName &&
      customStatuses.some((item) => item.projectId === projectId && item.id !== statusId && item.systemName === nextSystemName)
    ) {
      return reply.code(409).send({ code: "CUSTOM_STATUS_EXISTS", message: "custom status systemName already exists" });
    }
    const nextCanonical = body.canonicalStatus ?? row.canonicalStatus;
    const nextFlags = resolveStatusFlags(nextCanonical, {
      isFinal: body.isFinal ?? row.isFinal,
      isUntested: body.isUntested ?? row.isUntested
    });
    Object.assign(row, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(nextSystemName !== undefined ? { systemName: nextSystemName } : {}),
      ...(body.canonicalStatus !== undefined ? { canonicalStatus: body.canonicalStatus } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.isFinal !== undefined || body.canonicalStatus !== undefined ? { isFinal: nextFlags.isFinal } : {}),
      ...(body.isUntested !== undefined || body.canonicalStatus !== undefined ? { isUntested: nextFlags.isUntested } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {})
    });
    return reply.send(toJsonSafe(ok(row)));
  });

  app.delete("/api/projects/:projectId/settings/statuses/:statusId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, statusId } = customStatusIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const deleted = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existing = await tx.customStatus.findFirst({
            where: { id: statusId, projectId, deletedAt: null },
            select: { id: true, isSystem: true, name: true, systemName: true, canonicalStatus: true }
          });
          if (!existing) {
            throw new Error("CUSTOM_STATUS_NOT_FOUND");
          }
          if (existing.isSystem) {
            throw new Error("SYSTEM_STATUS_PROTECTED");
          }
          const row = await tx.customStatus.update({
            where: { id: existing.id },
            data: { deletedAt: new Date(), isActive: false, updatedBy: actor.id }
          });
          await tx.auditLog.create({
            data: {
              projectId,
              actorUserId: actor.id,
              action: "settings.custom_status.deleted",
              entityType: "custom_status",
              entityId: row.id.toString()
            }
          });
          return existing;
        });
        await recordActivityEvent(deps.prisma, {
          projectId,
          actorUserId: actor.id,
          entityType: "custom_status",
          entityId: deleted.id,
          eventType: "settings.custom_status.deleted",
          title: "Custom status deleted",
          body: deleted.name,
          payload: { systemName: deleted.systemName, canonicalStatus: deleted.canonicalStatus }
        });
      } catch (e) {
        if (e instanceof Error && e.message === "CUSTOM_STATUS_NOT_FOUND") {
          return reply.code(404).send({ code: "NOT_FOUND", message: "custom status not found" });
        }
        if (e instanceof Error && e.message === "SYSTEM_STATUS_PROTECTED") {
          return reply.code(409).send({ code: "SYSTEM_STATUS_PROTECTED", message: "system statuses cannot be deleted" });
        }
        throw e;
      }
      return reply.code(204).send();
    }
    const index = customStatuses.findIndex((item) => item.projectId === projectId && item.id === statusId);
    if (index === -1) return reply.code(404).send({ code: "NOT_FOUND", message: "custom status not found" });
    if (customStatuses[index]?.isSystem) {
      return reply.code(409).send({ code: "SYSTEM_STATUS_PROTECTED", message: "system statuses cannot be deleted" });
    }
    customStatuses.splice(index, 1);
    return reply.code(204).send();
  });
}
