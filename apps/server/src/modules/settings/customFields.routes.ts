import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

import {
  getAuthenticatedUser,
  requireProjectMutationRole,
  requireProjectPermission
} from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { visibilityRulesForStorage } from "../../domain/customFieldVisibility.js";
import { resolveProjectAccess } from "../permissions/projectAccess.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  customFieldAccessFlags,
  loadActiveCustomFields,
  visibilityContextFromAccess
} from "./customFieldAccess.js";
import {
  customFields,
  customFieldCreateSchema,
  customFieldUpdateSchema,
  customFieldIdParamSchema,
  type CustomFieldRow,
  normalizeSystemName,
  customFieldOptionsForStorage,
  fieldToResponse,
  fieldAuditChanges,
  type SettingsRouteDeps
} from "./settings.shared.js";
import { recordActivityEvent } from "../activity/activity.service.js";

function parseForUseQuery(query: Record<string, unknown> | undefined) {
  const raw = query?.forUse;
  return raw === true || raw === "true" || raw === "1";
}

function parseTemplateIdQuery(query: Record<string, unknown> | undefined) {
  const raw = query?.templateId;
  if (raw === undefined || raw === null || raw === "") return undefined;
  return String(raw);
}

export async function registerCustomFieldsRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings/custom-fields", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = (req.query ?? {}) as Record<string, unknown>;
    const rawScope = query.scope;
    const scope = rawScope === "case" || rawScope === "result" ? rawScope : undefined;
    const forUse = parseForUseQuery(query);
    const templateId = parseTemplateIdQuery(query);

    if (forUse && scope && deps.prisma) {
      await requireProjectPermission(
        req,
        deps,
        scope === "case" ? "cases.read" : "runs.read"
      );
      const user = await getAuthenticatedUser(req, deps);
      const access = await resolveProjectAccess(deps.prisma, user.id, projectId);
      if (!access) {
        return reply.send(toJsonSafe(paged([], 1, 100)));
      }
      const ctx = visibilityContextFromAccess(access, scope, templateId);
      const fields = await loadActiveCustomFields(deps.prisma, projectId, scope);
      const items = fields
        .filter((field) => customFieldAccessFlags(field, ctx).canView)
        .map((field) => fieldToResponse(field, customFieldAccessFlags(field, ctx)));
      return reply.send(toJsonSafe(paged(items, 1, 100)));
    }

    if (deps.prisma) {
      const rows = await deps.prisma.customField.findMany({
        where: { projectId, deletedAt: null, ...(scope ? { scope } : {}) },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
      });
      const items = rows.map((row) => fieldToResponse(row));
      return reply.send(toJsonSafe(paged(items, 1, 100)));
    }
    const memoryRows = customFields.filter(
      (item) => item.projectId === projectId && (!scope || item.scope === scope)
    );
    if (forUse && scope) {
      const user = await getAuthenticatedUser(req, deps);
      if (!deps.prisma) {
        const access = user
          ? { builtInRole: "owner" as const, userId: user.id, projectId, customRoleId: null, customRoleName: null, globalRole: "user" as const, permissions: [] }
          : null;
        if (!access) return reply.send(toJsonSafe(paged([], 1, 100)));
        const ctx = visibilityContextFromAccess(access, scope, templateId);
        const items = memoryRows
          .filter((field) => field.isActive && customFieldAccessFlags({ ...field, visibility: field.visibility ?? {} }, ctx).canView)
          .map((field) =>
            fieldToResponse(field, customFieldAccessFlags({ ...field, visibility: field.visibility ?? {} }, ctx))
          );
        return reply.send(toJsonSafe(paged(items, 1, 100)));
      }
    }
    return reply.send(toJsonSafe(paged(memoryRows.map((row) => fieldToResponse(row)), 1, 100)));
  });

  app.post("/api/projects/:projectId/settings/custom-fields", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'settings.write' });
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
              options: customFieldOptionsForStorage(body.fieldType, body.options),
              isRequired: body.isRequired,
              isActive: body.isActive,
              displayOrder: body.displayOrder,
              visibility: (visibilityRulesForStorage(body.visibility) ?? Prisma.DbNull) as Prisma.InputJsonValue,
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
        await recordActivityEvent(deps.prisma, {
          projectId,
          actorUserId: actor.id,
          entityType: "custom_field",
          entityId: row.id,
          eventType: "settings.custom_field.created",
          title: "Custom field created",
          body: row.name,
          payload: { scope: row.scope, systemName: row.systemName, fieldType: row.fieldType }
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
      options: customFieldOptionsForStorage(body.fieldType, body.options),
      isRequired: body.isRequired,
      isActive: body.isActive,
      displayOrder: body.displayOrder,
      visibility: visibilityRulesForStorage(body.visibility)
    };
    customFields.push(row);
    return reply.send(toJsonSafe(ok(fieldToResponse(row))));
  });

  app.patch("/api/projects/:projectId/settings/custom-fields/:fieldId", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'settings.write' });
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
            select: { id: true, fieldType: true }
          });
          if (!existing) {
            throw new Error("CUSTOM_FIELD_NOT_FOUND");
          }
          const nextFieldType = body.fieldType ?? existing.fieldType;
          const updated = await tx.customField.update({
            where: { id: existing.id },
            data: {
              ...(body.name !== undefined ? { name: body.name } : {}),
              ...(nextSystemName !== undefined ? { systemName: nextSystemName } : {}),
              ...(body.fieldType !== undefined ? { fieldType: body.fieldType } : {}),
              ...(body.scope !== undefined ? { scope: body.scope } : {}),
              ...(body.options !== undefined || body.fieldType !== undefined
                ? {
                    options: customFieldOptionsForStorage(
                      nextFieldType as CustomFieldRow["fieldType"],
                      body.options ?? []
                    )
                  }
                : {}),
              ...(body.isRequired !== undefined ? { isRequired: body.isRequired } : {}),
              ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
              ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
              ...(body.visibility !== undefined
                ? {
                    visibility: (visibilityRulesForStorage(body.visibility) ??
                      Prisma.DbNull) as Prisma.InputJsonValue
                  }
                : {}),
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
        await recordActivityEvent(deps.prisma, {
          projectId,
          actorUserId: actor.id,
          entityType: "custom_field",
          entityId: row.id,
          eventType: "settings.custom_field.updated",
          title: "Custom field updated",
          body: row.name,
          payload: { scope: row.scope, systemName: row.systemName, fieldType: row.fieldType }
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
    const nextFieldType = body.fieldType ?? row.fieldType;
    Object.assign(row, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(nextSystemName !== undefined ? { systemName: nextSystemName } : {}),
      ...(body.fieldType !== undefined ? { fieldType: body.fieldType } : {}),
      ...(body.scope !== undefined ? { scope: body.scope } : {}),
      ...(body.options !== undefined || body.fieldType !== undefined
        ? { options: customFieldOptionsForStorage(nextFieldType, body.options ?? row.options) }
        : {}),
      ...(body.isRequired !== undefined ? { isRequired: body.isRequired } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
      ...(body.visibility !== undefined ? { visibility: visibilityRulesForStorage(body.visibility) } : {})
    });
    return reply.send(toJsonSafe(ok(fieldToResponse(row))));
  });

  app.delete("/api/projects/:projectId/settings/custom-fields/:fieldId", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'settings.write' });
    const { projectId, fieldId } = customFieldIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const deleted = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existing = await tx.customField.findFirst({
            where: { id: fieldId, projectId, deletedAt: null },
            select: { id: true, name: true, scope: true, systemName: true, fieldType: true }
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
          return existing;
        });
        await recordActivityEvent(deps.prisma, {
          projectId,
          actorUserId: actor.id,
          entityType: "custom_field",
          entityId: deleted.id,
          eventType: "settings.custom_field.deleted",
          title: "Custom field deleted",
          body: deleted.name,
          payload: { scope: deleted.scope, systemName: deleted.systemName, fieldType: deleted.fieldType }
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

