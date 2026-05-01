import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  customFields,
  customFieldCreateSchema,
  customFieldUpdateSchema,
  customFieldIdParamSchema,
  type CustomFieldRow,
  normalizeSystemName,
  fieldToResponse,
  fieldAuditChanges,
  type SettingsRouteDeps
} from "./settings.shared.js";

export async function registerCustomFieldsRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings/custom-fields", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const rawScope = (req.query as { scope?: unknown } | undefined)?.scope;
    const scope = rawScope === "case" || rawScope === "result" ? rawScope : undefined;
    if (deps.prisma) {
      const rows = await deps.prisma.customField.findMany({
        where: { projectId, deletedAt: null, ...(scope ? { scope } : {}) },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
      });
      const items = rows.map(fieldToResponse);
      return reply.send(toJsonSafe(paged(items, 1, 100)));
    }
    return reply.send(
      toJsonSafe(paged(customFields.filter((item) => item.projectId === projectId && (!scope || item.scope === scope)), 1, 100))
    );
  });

  app.post("/api/projects/:projectId/settings/custom-fields", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = customFieldCreateSchema.parse(req.body);
    const systemName = normalizeSystemName(body.systemName ?? body.name);
    if (!systemName) {
      return reply.code(400).send({ code: "INVALID_CUSTOM_FIELD", message: "systemName must contain a letter or number" });
    }
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const row = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const created = await tx.customField.create({
            data: {
              projectId,
              name: body.name,
              systemName,
              fieldType: body.fieldType,
              scope: body.scope,
              options: body.fieldType === "select" ? body.options : [],
              isRequired: body.isRequired,
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
              action: "settings.custom_field.created",
              entityType: "custom_field",
              entityId: created.id.toString(),
              changes: fieldAuditChanges(fieldToResponse(created))
            }
          });
          return created;
        });
        return reply.send(toJsonSafe(ok(fieldToResponse(row))));
      } catch (e) {
        if (e instanceof Error && e.message.includes("Unique constraint")) {
          return reply.code(409).send({ code: "CUSTOM_FIELD_EXISTS", message: "custom field systemName already exists" });
        }
        throw e;
      }
    }
    if (customFields.some((item) => item.projectId === projectId && item.systemName === systemName)) {
      return reply.code(409).send({ code: "CUSTOM_FIELD_EXISTS", message: "custom field systemName already exists" });
    }
    const row: CustomFieldRow = {
      id: BigInt(Date.now()),
      projectId,
      name: body.name,
      systemName,
      fieldType: body.fieldType,
      scope: body.scope,
      options: body.fieldType === "select" ? body.options : [],
      isRequired: body.isRequired,
      isActive: body.isActive,
      displayOrder: body.displayOrder
    };
    customFields.push(row);
    return reply.send(toJsonSafe(ok(row)));
  });

  app.patch("/api/projects/:projectId/settings/custom-fields/:fieldId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, fieldId } = customFieldIdParamSchema.parse(req.params);
    const body = customFieldUpdateSchema.parse(req.body);
    const nextSystemName = body.systemName !== undefined ? normalizeSystemName(body.systemName) : undefined;
    if (body.systemName !== undefined && !nextSystemName) {
      return reply.code(400).send({ code: "INVALID_CUSTOM_FIELD", message: "systemName must contain a letter or number" });
    }
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const row = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existing = await tx.customField.findFirst({
            where: { id: fieldId, projectId, deletedAt: null },
            select: { id: true }
          });
          if (!existing) {
            throw new Error("CUSTOM_FIELD_NOT_FOUND");
          }
          const updated = await tx.customField.update({
            where: { id: existing.id },
            data: {
              ...(body.name !== undefined ? { name: body.name } : {}),
              ...(nextSystemName !== undefined ? { systemName: nextSystemName } : {}),
              ...(body.fieldType !== undefined ? { fieldType: body.fieldType } : {}),
              ...(body.scope !== undefined ? { scope: body.scope } : {}),
              ...(body.options !== undefined || body.fieldType !== undefined
                ? { options: body.fieldType === "select" || body.options !== undefined ? body.options ?? [] : [] }
                : {}),
              ...(body.isRequired !== undefined ? { isRequired: body.isRequired } : {}),
              ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
              ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
              updatedBy: actor.id
            }
          });
          await tx.auditLog.create({
            data: {
              projectId,
              actorUserId: actor.id,
              action: "settings.custom_field.updated",
              entityType: "custom_field",
              entityId: updated.id.toString(),
              changes: fieldAuditChanges(fieldToResponse(updated))
            }
          });
          return updated;
        });
        return reply.send(toJsonSafe(ok(fieldToResponse(row))));
      } catch (e) {
        if (e instanceof Error && e.message === "CUSTOM_FIELD_NOT_FOUND") {
          return reply.code(404).send({ code: "NOT_FOUND", message: "custom field not found" });
        }
        if (e instanceof Error && e.message.includes("Unique constraint")) {
          return reply.code(409).send({ code: "CUSTOM_FIELD_EXISTS", message: "custom field systemName already exists" });
        }
        throw e;
      }
    }
    const row = customFields.find((item) => item.projectId === projectId && item.id === fieldId);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "custom field not found" });
    if (
      nextSystemName &&
      customFields.some((item) => item.projectId === projectId && item.id !== fieldId && item.systemName === nextSystemName)
    ) {
      return reply.code(409).send({ code: "CUSTOM_FIELD_EXISTS", message: "custom field systemName already exists" });
    }
    Object.assign(row, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(nextSystemName !== undefined ? { systemName: nextSystemName } : {}),
      ...(body.fieldType !== undefined ? { fieldType: body.fieldType } : {}),
      ...(body.scope !== undefined ? { scope: body.scope } : {}),
      ...(body.options !== undefined ? { options: body.options } : {}),
      ...(body.isRequired !== undefined ? { isRequired: body.isRequired } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {})
    });
    return reply.send(toJsonSafe(ok(row)));
  });

  app.delete("/api/projects/:projectId/settings/custom-fields/:fieldId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, fieldId } = customFieldIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existing = await tx.customField.findFirst({
            where: { id: fieldId, projectId, deletedAt: null },
            select: { id: true }
          });
          if (!existing) {
            throw new Error("CUSTOM_FIELD_NOT_FOUND");
          }
          const row = await tx.customField.update({
            where: { id: existing.id },
            data: { deletedAt: new Date(), isActive: false, updatedBy: actor.id }
          });
          await tx.auditLog.create({
            data: {
              projectId,
              actorUserId: actor.id,
              action: "settings.custom_field.deleted",
              entityType: "custom_field",
              entityId: row.id.toString()
            }
          });
        });
      } catch (e) {
        if (e instanceof Error && e.message === "CUSTOM_FIELD_NOT_FOUND") {
          return reply.code(404).send({ code: "NOT_FOUND", message: "custom field not found" });
        }
        throw e;
      }
      return reply.code(204).send();
    }
    const index = customFields.findIndex((item) => item.projectId === projectId && item.id === fieldId);
    if (index === -1) return reply.code(404).send({ code: "NOT_FOUND", message: "custom field not found" });
    customFields.splice(index, 1);
    return reply.code(204).send();
  });
}
