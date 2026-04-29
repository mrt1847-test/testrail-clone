import type { FastifyInstance } from "fastify";
import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { testStatuses, type TestStatus } from "../../domain/status.js";
import type { AuthService } from "../auth/auth.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";

type CustomFieldRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  systemName: string;
  fieldType: CustomFieldType;
  options: string[];
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
};

type WebhookRow = {
  id: bigint;
  projectId: bigint;
  event: string;
  targetUrl: string;
  isActive: boolean;
};

type CustomStatusRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  systemName: string;
  canonicalStatus: TestStatus;
  color: string;
  isSystem: boolean;
  isActive: boolean;
  displayOrder: number;
};

const customFields: CustomFieldRow[] = [];
const customStatuses: CustomStatusRow[] = [];
const webhooks: WebhookRow[] = [];

type CustomFieldType = "text" | "number" | "select";

const customFieldTypeSchema = z.enum(["text", "number", "select"]);
const customFieldCreateSchema = z.object({
  name: z.string().trim().min(1),
  systemName: z.string().trim().min(1).optional(),
  fieldType: customFieldTypeSchema.default("text"),
  options: z.array(z.string().trim().min(1)).default([]),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0)
});
const customFieldUpdateSchema = customFieldCreateSchema.partial();
const customFieldIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  fieldId: z.coerce.bigint()
});
const canonicalStatusSchema = z.enum(["untested", "passed", "failed", "blocked", "retest"]);
const customStatusCreateSchema = z.object({
  name: z.string().trim().min(1),
  systemName: z.string().trim().min(1).optional(),
  canonicalStatus: canonicalStatusSchema.default("untested"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0)
});
const customStatusUpdateSchema = customStatusCreateSchema.partial();
const customStatusIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  statusId: z.coerce.bigint()
});
const memberRoleSchema = z.enum(["owner", "manager", "tester", "viewer"]);
const addMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: memberRoleSchema.default("viewer")
});
const updateMemberRoleSchema = z.object({
  role: memberRoleSchema
});
const memberIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  memberId: z.coerce.bigint()
});

async function enforceNotLastOwner(
  tx: Prisma.TransactionClient,
  input: { projectId: bigint; memberId: bigint; nextRole?: string; deleting?: boolean }
) {
  const existing = await tx.projectMember.findFirst({
    where: { id: input.memberId, projectId: input.projectId, deletedAt: null },
    select: { id: true, role: true }
  });
  if (!existing) return { exists: false as const };
  const demoteOrDeleteOwner =
    existing.role === "owner" && (input.deleting === true || (input.nextRole !== undefined && input.nextRole !== "owner"));
  if (!demoteOrDeleteOwner) return { exists: true as const, existing };
  const ownerCount = await tx.projectMember.count({
    where: { projectId: input.projectId, deletedAt: null, role: "owner" }
  });
  if (ownerCount <= 1) {
    throw new Error("LAST_OWNER_PROTECTED");
  }
  return { exists: true as const, existing };
}

function normalizeSystemName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function fieldToResponse(row: {
  id: bigint;
  name: string;
  systemName: string;
  fieldType: string;
  options: Prisma.JsonValue | null;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
}) {
  return {
    id: row.id,
    name: row.name,
    systemName: row.systemName,
    fieldType: row.fieldType,
    options: Array.isArray(row.options) ? row.options.filter((item): item is string => typeof item === "string") : [],
    isRequired: row.isRequired,
    isActive: row.isActive,
    displayOrder: row.displayOrder
  };
}

function fieldAuditChanges(row: ReturnType<typeof fieldToResponse>) {
  return {
    ...row,
    id: row.id.toString()
  };
}

function statusToResponse(row: {
  id: bigint;
  name: string;
  systemName: string;
  canonicalStatus: string;
  color: string;
  isSystem: boolean;
  isActive: boolean;
  displayOrder: number;
}) {
  return {
    id: row.id,
    name: row.name,
    systemName: row.systemName,
    canonicalStatus: testStatuses.includes(row.canonicalStatus as TestStatus)
      ? (row.canonicalStatus as TestStatus)
      : "untested",
    color: row.color,
    isSystem: row.isSystem,
    isActive: row.isActive,
    displayOrder: row.displayOrder
  };
}

function statusAuditChanges(row: ReturnType<typeof statusToResponse>) {
  return {
    ...row,
    id: row.id.toString()
  };
}

function defaultStatusRows(projectId: bigint): CustomStatusRow[] {
  return [
    { id: 1n, projectId, name: "Untested", systemName: "untested", canonicalStatus: "untested", color: "#64748b", isSystem: true, isActive: true, displayOrder: 0 },
    { id: 2n, projectId, name: "Passed", systemName: "passed", canonicalStatus: "passed", color: "#15803d", isSystem: true, isActive: true, displayOrder: 10 },
    { id: 3n, projectId, name: "Failed", systemName: "failed", canonicalStatus: "failed", color: "#b91c1c", isSystem: true, isActive: true, displayOrder: 20 },
    { id: 4n, projectId, name: "Blocked", systemName: "blocked", canonicalStatus: "blocked", color: "#a16207", isSystem: true, isActive: true, displayOrder: 30 },
    { id: 5n, projectId, name: "Retest", systemName: "retest", canonicalStatus: "retest", color: "#0369a1", isSystem: true, isActive: true, displayOrder: 40 }
  ];
}

export async function registerSettingsRoutes(
  app: FastifyInstance,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/projects/:projectId/settings", async (req, reply) => {
    projectIdParamSchema.parse(req.params);
    return reply.send(
      ok({
        retentionDays: 90,
        strictPermissions: true
      })
    );
  });

  app.get("/api/projects/:projectId/settings/custom-fields", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.customField.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
      });
      const items = rows.map(fieldToResponse);
      return reply.send(toJsonSafe(paged(items, 1, 100)));
    }
    return reply.send(toJsonSafe(paged(customFields.filter((item) => item.projectId === projectId), 1, 100)));
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
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      try {
        const row = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const created = await tx.customStatus.create({
            data: {
              projectId,
              name: body.name,
              systemName,
              canonicalStatus: body.canonicalStatus,
              color: body.color,
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
    const row: CustomStatusRow = {
      id: BigInt(Date.now()),
      projectId,
      name: body.name,
      systemName,
      canonicalStatus: body.canonicalStatus,
      color: body.color,
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
          const updated = await tx.customStatus.update({
            where: { id: existing.id },
            data: {
              ...(body.name !== undefined ? { name: body.name } : {}),
              ...(nextSystemName !== undefined ? { systemName: nextSystemName } : {}),
              ...(body.canonicalStatus !== undefined ? { canonicalStatus: body.canonicalStatus } : {}),
              ...(body.color !== undefined ? { color: body.color } : {}),
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
    Object.assign(row, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(nextSystemName !== undefined ? { systemName: nextSystemName } : {}),
      ...(body.canonicalStatus !== undefined ? { canonicalStatus: body.canonicalStatus } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
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
        await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existing = await tx.customStatus.findFirst({
            where: { id: statusId, projectId, deletedAt: null },
            select: { id: true, isSystem: true }
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

  app.get("/api/projects/:projectId/settings/webhooks", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const logs = await deps.prisma.auditLog.findMany({
        where: { projectId, entityType: "webhook" },
        orderBy: { id: "desc" },
        take: 100
      });
      const items = logs
        .map((row: (typeof logs)[number]) => row.changes as { event?: string; targetUrl?: string; isActive?: boolean } | null)
        .filter(
          (
            value: { event?: string; targetUrl?: string; isActive?: boolean } | null
          ): value is { event?: string; targetUrl?: string; isActive?: boolean } => Boolean(value?.event)
        )
        .map((value: { event?: string; targetUrl?: string; isActive?: boolean }, index: number) => ({
          id: BigInt(index + 1),
          event: value.event!,
          targetUrl: value.targetUrl ?? "",
          isActive: value.isActive ?? true
        }));
      return reply.send(toJsonSafe(paged(items, 1, 100)));
    }
    return reply.send(toJsonSafe(paged(webhooks.filter((item) => item.projectId === projectId), 1, 100)));
  });

  app.post("/api/projects/:projectId/settings/webhooks", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = req.body as { event?: string; targetUrl?: string };
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      await deps.prisma.auditLog.create({
        data: {
          projectId,
          actorUserId: actor.id,
          action: "settings.webhook.created",
          entityType: "webhook",
          entityId: `${Date.now()}`,
          changes: {
            event: body.event?.trim() || "result.created",
            targetUrl: body.targetUrl?.trim() || "https://example.com/webhook",
            isActive: true
          }
        }
      });
      return reply.send(
        toJsonSafe({
          data: {
            id: BigInt(Date.now()),
            event: body.event?.trim() || "result.created",
            targetUrl: body.targetUrl?.trim() || "https://example.com/webhook",
            isActive: true
          }
        })
      );
    }
    const row: WebhookRow = {
      id: BigInt(Date.now()),
      projectId,
      event: body.event?.trim() || "result.created",
      targetUrl: body.targetUrl?.trim() || "https://example.com/webhook",
      isActive: true
    };
    webhooks.unshift(row);
    return reply.send(toJsonSafe({ data: row }));
  });

  app.get("/api/projects/:projectId/settings/audit-logs", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.auditLog.findMany({
        where: { projectId },
        orderBy: { id: "desc" },
        take: 100
      });
      return reply.send(
        toJsonSafe(
          ok({
            items: rows.map((row: (typeof rows)[number]) => ({
              id: row.id,
              action: row.action,
              actorUserId: row.actorUserId,
              entityType: row.entityType,
              entityId: row.entityId,
              changes: row.changes,
              createdAt: row.createdAt
            })),
            filters: ["actor", "entity_type", "action", "from", "to"]
          })
        )
      );
    }
    return reply.send(
      ok({
        items: [],
        filters: ["actor", "entity_type", "action", "from", "to"]
      })
    );
  });

  app.get("/api/projects/:projectId/settings/members", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.send(toJsonSafe(paged([], 1, 100)));
    }
    const rows = await deps.prisma.projectMember.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, email: true, name: true } }
      }
    });
    return reply.send(
      toJsonSafe(
        paged(
          rows.map((row: (typeof rows)[number]) => ({
            id: row.id,
            userId: row.user.id,
            email: row.user.email,
            name: row.user.name,
            role: row.role
          })),
          1,
          100
        )
      )
    );
  });

  app.post("/api/projects/:projectId/settings/members", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "members API needs prisma mode" });
    }
    const body = addMemberSchema.parse(req.body);
    const actor = await getAuthenticatedUser(req, deps);
    const normalizedEmail = body.email.trim().toLowerCase();
    const result = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.upsert({
        where: { email: normalizedEmail },
        update: {},
        create: { email: normalizedEmail, name: body.name ?? normalizedEmail.split("@")[0] ?? "User" }
      });
      const member = await tx.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: user.id } },
        update: { role: body.role, deletedAt: null, updatedBy: actor.id },
        create: {
          projectId,
          userId: user.id,
          role: body.role,
          createdBy: actor.id,
          updatedBy: actor.id
        }
      });
      await tx.auditLog.create({
        data: {
          projectId,
          actorUserId: actor.id,
          action: "project.member.upsert",
          entityType: "project_member",
          entityId: member.id.toString(),
          changes: { role: member.role, email: user.email }
        }
      });
      return { id: member.id, userId: user.id, email: user.email, name: user.name, role: member.role };
    });
    return reply.send(toJsonSafe(ok(result)));
  });

  app.patch("/api/projects/:projectId/settings/members/:memberId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, memberId } = memberIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "members API needs prisma mode" });
    }
    const body = updateMemberRoleSchema.parse(req.body);
    const actor = await getAuthenticatedUser(req, deps);
    try {
      const updated = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const checked = await enforceNotLastOwner(tx, { projectId, memberId, nextRole: body.role });
        if (!checked.exists) {
          throw new Error("MEMBER_NOT_FOUND");
        }
        const row = await tx.projectMember.update({
          where: { id: memberId },
          data: { role: body.role, updatedBy: actor.id },
          select: { id: true, role: true, user: { select: { id: true, email: true, name: true } } }
        });
        await tx.auditLog.create({
          data: {
            projectId,
            actorUserId: actor.id,
            action: "project.member.role.updated",
            entityType: "project_member",
            entityId: row.id.toString(),
            changes: { role: body.role }
          }
        });
        return row;
      });
      return reply.send(
        toJsonSafe(
          ok({
            id: updated.id,
            userId: updated.user.id,
            email: updated.user.email,
            name: updated.user.name,
            role: updated.role
          })
        )
      );
    } catch (e) {
      if (e instanceof Error && e.message === "MEMBER_NOT_FOUND") {
        return reply.code(404).send({ code: "NOT_FOUND", message: "member not found" });
      }
      if (e instanceof Error && e.message === "LAST_OWNER_PROTECTED") {
        return reply.code(409).send({ code: "LAST_OWNER_PROTECTED", message: "at least one owner is required" });
      }
      throw e;
    }
  });

  app.delete("/api/projects/:projectId/settings/members/:memberId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, memberId } = memberIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "members API needs prisma mode" });
    }
    const actor = await getAuthenticatedUser(req, deps);
    try {
      await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const checked = await enforceNotLastOwner(tx, { projectId, memberId, deleting: true });
        if (!checked.exists) {
          throw new Error("MEMBER_NOT_FOUND");
        }
        await tx.projectMember.update({
          where: { id: memberId },
          data: { deletedAt: new Date(), updatedBy: actor.id }
        });
        await tx.auditLog.create({
          data: {
            projectId,
            actorUserId: actor.id,
            action: "project.member.removed",
            entityType: "project_member",
            entityId: memberId.toString()
          }
        });
      });
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof Error && e.message === "MEMBER_NOT_FOUND") {
        return reply.code(404).send({ code: "NOT_FOUND", message: "member not found" });
      }
      if (e instanceof Error && e.message === "LAST_OWNER_PROTECTED") {
        return reply.code(409).send({ code: "LAST_OWNER_PROTECTED", message: "at least one owner is required" });
      }
      throw e;
    }
  });
}
