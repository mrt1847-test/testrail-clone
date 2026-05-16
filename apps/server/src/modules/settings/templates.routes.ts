import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  caseTemplates,
  caseTemplateCreateSchema,
  caseTemplateUpdateSchema,
  caseTemplateIdParamSchema,
  type CaseTemplateRow,
  templateToResponse,
  templateAuditChanges,
  type SettingsRouteDeps
} from "./settings.shared.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import {
  ensureDefaultCaseTemplates,
  ensureDefaultCaseTemplatesInMemory
} from "./caseTemplates.service.js";

export async function registerTemplatesRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings/templates", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      await ensureDefaultCaseTemplates(deps.prisma, projectId);
      const rows = await deps.prisma.caseTemplate.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
      });
      return reply.send(toJsonSafe(paged(rows.map(templateToResponse), 1, 100)));
    }
    ensureDefaultCaseTemplatesInMemory(projectId, caseTemplates);
    return reply.send(toJsonSafe(paged(caseTemplates.filter((item) => item.projectId === projectId), 1, 100)));
  });

  app.post("/api/projects/:projectId/settings/templates", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = caseTemplateCreateSchema.parse(req.body);
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const row = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          if (body.isDefault) {
            await tx.caseTemplate.updateMany({
              where: { projectId, deletedAt: null, isDefault: true },
              data: { isDefault: false, updatedBy: actor.id }
            });
          }
          const created = await tx.caseTemplate.create({
            data: {
              projectId,
              name: body.name,
              description: body.description ?? null,
              fields: body.fields,
              isDefault: body.isDefault,
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
              action: "settings.case_template.created",
              entityType: "case_template",
              entityId: created.id.toString(),
              changes: templateAuditChanges(templateToResponse(created))
            }
          });
          return created;
        });
        await recordActivityEvent(deps.prisma, {
          projectId,
          actorUserId: actor.id,
          entityType: "case_template",
          entityId: row.id,
          eventType: "settings.case_template.created",
          title: "Case template created",
          body: row.name,
          payload: { isDefault: row.isDefault, isActive: row.isActive }
        });
        return reply.send(toJsonSafe(ok(templateToResponse(row))));
      } catch (e) {
        if (e instanceof Error && e.message.includes("Unique constraint")) {
          return reply.code(409).send({ code: "CASE_TEMPLATE_EXISTS", message: "case template name already exists" });
        }
        throw e;
      }
    }
    if (caseTemplates.some((item) => item.projectId === projectId && item.name === body.name)) {
      return reply.code(409).send({ code: "CASE_TEMPLATE_EXISTS", message: "case template name already exists" });
    }
    if (body.isDefault) {
      caseTemplates.forEach((item) => {
        if (item.projectId === projectId) item.isDefault = false;
      });
    }
    const row: CaseTemplateRow = {
      id: BigInt(Date.now()),
      projectId,
      systemKey: null,
      name: body.name,
      description: body.description ?? null,
      fields: body.fields,
      isDefault: body.isDefault,
      isActive: body.isActive,
      displayOrder: body.displayOrder
    };
    caseTemplates.push(row);
    return reply.send(toJsonSafe(ok(row)));
  });

  app.patch("/api/projects/:projectId/settings/templates/:templateId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, templateId } = caseTemplateIdParamSchema.parse(req.params);
    const body = caseTemplateUpdateSchema.parse(req.body);
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const row = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existing = await tx.caseTemplate.findFirst({
            where: { id: templateId, projectId, deletedAt: null },
            select: { id: true }
          });
          if (!existing) {
            throw new Error("CASE_TEMPLATE_NOT_FOUND");
          }
          if (body.isDefault) {
            await tx.caseTemplate.updateMany({
              where: { projectId, deletedAt: null, isDefault: true, NOT: { id: existing.id } },
              data: { isDefault: false, updatedBy: actor.id }
            });
          }
          const updated = await tx.caseTemplate.update({
            where: { id: existing.id },
            data: {
              ...(body.name !== undefined ? { name: body.name } : {}),
              ...(body.description !== undefined ? { description: body.description } : {}),
              ...(body.fields !== undefined ? { fields: body.fields } : {}),
              ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
              ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
              ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
              updatedBy: actor.id
            }
          });
          await tx.auditLog.create({
            data: {
              projectId,
              actorUserId: actor.id,
              action: "settings.case_template.updated",
              entityType: "case_template",
              entityId: updated.id.toString(),
              changes: templateAuditChanges(templateToResponse(updated))
            }
          });
          return updated;
        });
        await recordActivityEvent(deps.prisma, {
          projectId,
          actorUserId: actor.id,
          entityType: "case_template",
          entityId: row.id,
          eventType: "settings.case_template.updated",
          title: "Case template updated",
          body: row.name,
          payload: { isDefault: row.isDefault, isActive: row.isActive }
        });
        return reply.send(toJsonSafe(ok(templateToResponse(row))));
      } catch (e) {
        if (e instanceof Error && e.message === "CASE_TEMPLATE_NOT_FOUND") {
          return reply.code(404).send({ code: "NOT_FOUND", message: "case template not found" });
        }
        if (e instanceof Error && e.message.includes("Unique constraint")) {
          return reply.code(409).send({ code: "CASE_TEMPLATE_EXISTS", message: "case template name already exists" });
        }
        throw e;
      }
    }
    const row = caseTemplates.find((item) => item.projectId === projectId && item.id === templateId);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "case template not found" });
    if (body.name && caseTemplates.some((item) => item.projectId === projectId && item.id !== templateId && item.name === body.name)) {
      return reply.code(409).send({ code: "CASE_TEMPLATE_EXISTS", message: "case template name already exists" });
    }
    if (body.isDefault) {
      caseTemplates.forEach((item) => {
        if (item.projectId === projectId && item.id !== templateId) item.isDefault = false;
      });
    }
    Object.assign(row, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.fields !== undefined ? { fields: body.fields } : {}),
      ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {})
    });
    return reply.send(toJsonSafe(ok(row)));
  });

  app.delete("/api/projects/:projectId/settings/templates/:templateId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, templateId } = caseTemplateIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const deleted = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existing = await tx.caseTemplate.findFirst({
            where: { id: templateId, projectId, deletedAt: null },
            select: { id: true, name: true, isDefault: true, isActive: true }
          });
          if (!existing) {
            throw new Error("CASE_TEMPLATE_NOT_FOUND");
          }
          const row = await tx.caseTemplate.update({
            where: { id: existing.id },
            data: { deletedAt: new Date(), isActive: false, isDefault: false, updatedBy: actor.id }
          });
          await tx.auditLog.create({
            data: {
              projectId,
              actorUserId: actor.id,
              action: "settings.case_template.deleted",
              entityType: "case_template",
              entityId: row.id.toString()
            }
          });
          return existing;
        });
        await recordActivityEvent(deps.prisma, {
          projectId,
          actorUserId: actor.id,
          entityType: "case_template",
          entityId: deleted.id,
          eventType: "settings.case_template.deleted",
          title: "Case template deleted",
          body: deleted.name,
          payload: { isDefault: deleted.isDefault, isActive: deleted.isActive }
        });
      } catch (e) {
        if (e instanceof Error && e.message === "CASE_TEMPLATE_NOT_FOUND") {
          return reply.code(404).send({ code: "NOT_FOUND", message: "case template not found" });
        }
        throw e;
      }
      return reply.code(204).send();
    }
    const index = caseTemplates.findIndex((item) => item.projectId === projectId && item.id === templateId);
    if (index === -1) return reply.code(404).send({ code: "NOT_FOUND", message: "case template not found" });
    caseTemplates.splice(index, 1);
    return reply.code(204).send();
  });
}
