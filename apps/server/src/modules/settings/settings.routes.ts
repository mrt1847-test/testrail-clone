import type { FastifyInstance } from "fastify";
import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { randomBytes } from "node:crypto";

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
  scope: CustomFieldScope;
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
  secret: string;
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

type CaseTemplateRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  description: string | null;
  fields: string[];
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
};

const customFields: CustomFieldRow[] = [];
const customStatuses: CustomStatusRow[] = [];
const caseTemplates: CaseTemplateRow[] = [];
const webhooks: WebhookRow[] = [];
const webhookAttempts: Array<{
  id: bigint;
  projectId: bigint;
  webhookId: bigint;
  event: string;
  targetUrl: string;
  status: string;
  attemptNo: number;
  signature: string;
  createdAt: Date;
}> = [];

type CustomFieldType = "text" | "number" | "select";
type CustomFieldScope = "case" | "result";

const customFieldTypeSchema = z.enum(["text", "number", "select"]);
const customFieldScopeSchema = z.enum(["case", "result"]);
const customFieldCreateSchema = z.object({
  name: z.string().trim().min(1),
  systemName: z.string().trim().min(1).optional(),
  fieldType: customFieldTypeSchema.default("text"),
  scope: customFieldScopeSchema.default("case"),
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
const caseTemplateCreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  fields: z.array(z.string().trim().min(1)).default(["title", "preconditions", "steps", "expectedResult"]),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0)
});
const caseTemplateUpdateSchema = caseTemplateCreateSchema.partial();
const caseTemplateIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  templateId: z.coerce.bigint()
});
const webhookCreateSchema = z.object({
  event: z.string().trim().min(1).default("*"),
  targetUrl: z.string().trim().url(),
  secret: z.string().trim().min(8).optional(),
  isActive: z.boolean().default(true)
});
const webhookUpdateSchema = webhookCreateSchema.partial();
const webhookIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  webhookId: z.coerce.bigint()
});
const webhookRetryParamSchema = z.object({
  projectId: z.coerce.bigint(),
  attemptId: z.coerce.bigint()
});
const webhookEvents = [
  "*",
  "case.*",
  "case.created",
  "case.updated",
  "case.deleted",
  "case.version_restored",
  "run.*",
  "run.created",
  "run.assigned",
  "run.closed",
  "run.rerun_created",
  "test.assigned",
  "result.*",
  "result.created",
  "result.failed",
  "defect.linked",
  "defect.pushed"
] as const;
const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  action: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  actorUserId: z.coerce.bigint().optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  q: z.string().trim().min(1).optional()
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
  scope?: string;
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
    scope: row.scope === "result" ? "result" : "case",
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

function templateToResponse(row: {
  id: bigint;
  name: string;
  description: string | null;
  fields: Prisma.JsonValue;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fields: Array.isArray(row.fields) ? row.fields.filter((item): item is string => typeof item === "string") : [],
    isDefault: row.isDefault,
    isActive: row.isActive,
    displayOrder: row.displayOrder
  };
}

function templateAuditChanges(row: ReturnType<typeof templateToResponse>) {
  return {
    ...row,
    id: row.id.toString()
  };
}

function newWebhookSecret() {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

function webhookToResponse(row: {
  id: bigint;
  event: string;
  targetUrl: string;
  secret: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: row.id,
    event: row.event,
    targetUrl: row.targetUrl,
    secretPrefix: `${row.secret.slice(0, 10)}...`,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function webhookAttemptToResponse(row: {
  id: bigint;
  webhookId: bigint;
  activityEventId?: bigint | null;
  event: string;
  targetUrl: string;
  status: string;
  attemptNo: number;
  responseStatus?: number | null;
  error?: string | null;
  nextRetryAt?: Date | null;
  deliveredAt?: Date | null;
  signature: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    webhookId: row.webhookId,
    activityEventId: row.activityEventId ?? null,
    event: row.event,
    targetUrl: row.targetUrl,
    status: row.status,
    attemptNo: row.attemptNo,
    responseStatus: row.responseStatus ?? null,
    error: row.error ?? null,
    nextRetryAt: row.nextRetryAt ?? null,
    deliveredAt: row.deliveredAt ?? null,
    signaturePrefix: `${row.signature.slice(0, 18)}...`,
    createdAt: row.createdAt
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

  app.get("/api/projects/:projectId/settings/templates", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.caseTemplate.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
      });
      return reply.send(toJsonSafe(paged(rows.map(templateToResponse), 1, 100)));
    }
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
        await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const existing = await tx.caseTemplate.findFirst({
            where: { id: templateId, projectId, deletedAt: null },
            select: { id: true }
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

  app.get("/api/projects/:projectId/settings/webhooks", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.webhookSubscription.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ isActive: "desc" }, { id: "desc" }],
        take: 100,
        select: {
          id: true,
          event: true,
          targetUrl: true,
          secret: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return reply.send(toJsonSafe(paged(rows.map(webhookToResponse), 1, 100)));
    }
    return reply.send(toJsonSafe(paged(webhooks.filter((item) => item.projectId === projectId).map(webhookToResponse), 1, 100)));
  });

  app.get("/api/projects/:projectId/settings/webhook-events", async (req, reply) => {
    projectIdParamSchema.parse(req.params);
    return reply.send(ok({ events: [...webhookEvents] }));
  });

  app.get("/api/projects/:projectId/settings/webhook-attempts", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.webhookDeliveryAttempt.findMany({
        where: { projectId },
        orderBy: { id: "desc" },
        take: 50,
        select: {
          id: true,
          webhookId: true,
          activityEventId: true,
          event: true,
          targetUrl: true,
          status: true,
          attemptNo: true,
          responseStatus: true,
          error: true,
          nextRetryAt: true,
          deliveredAt: true,
          signature: true,
          createdAt: true
        }
      });
      return reply.send(toJsonSafe(paged(rows.map(webhookAttemptToResponse), 1, 50)));
    }
    return reply.send(
      toJsonSafe(paged(webhookAttempts.filter((item) => item.projectId === projectId).map(webhookAttemptToResponse), 1, 50))
    );
  });

  app.post("/api/projects/:projectId/settings/webhooks", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = webhookCreateSchema.parse(req.body ?? {});
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      const created = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const row = await tx.webhookSubscription.create({
          data: {
            projectId,
            event: body.event,
            targetUrl: body.targetUrl,
            secret: body.secret ?? newWebhookSecret(),
            isActive: body.isActive,
            createdBy: actor.id,
            updatedBy: actor.id
          }
        });
        await tx.auditLog.create({
          data: {
            projectId,
            actorUserId: actor.id,
            action: "settings.webhook.created",
            entityType: "webhook",
            entityId: row.id.toString(),
            changes: {
              event: row.event,
              targetUrl: row.targetUrl,
              isActive: row.isActive
            }
          }
        });
        return row;
      });
      return reply.send(toJsonSafe(ok(webhookToResponse(created))));
    }
    const row: WebhookRow = {
      id: BigInt(Date.now()),
      projectId,
      event: body.event,
      targetUrl: body.targetUrl,
      secret: body.secret ?? newWebhookSecret(),
      isActive: body.isActive
    };
    webhooks.unshift(row);
    return reply.send(toJsonSafe(ok(webhookToResponse(row))));
  });

  app.patch("/api/projects/:projectId/settings/webhooks/:webhookId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, webhookId } = webhookIdParamSchema.parse(req.params);
    const body = webhookUpdateSchema.parse(req.body ?? {});
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      const existing = await deps.prisma.webhookSubscription.findFirst({
        where: { id: webhookId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!existing) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
      const updated = await deps.prisma.webhookSubscription.update({
        where: { id: existing.id },
        data: {
          ...(body.event !== undefined ? { event: body.event } : {}),
          ...(body.targetUrl !== undefined ? { targetUrl: body.targetUrl } : {}),
          ...(body.secret !== undefined ? { secret: body.secret } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          updatedBy: actor.id
        }
      });
      await deps.prisma.auditLog.create({
        data: {
          projectId,
          actorUserId: actor.id,
          action: "settings.webhook.updated",
          entityType: "webhook",
          entityId: updated.id.toString(),
          changes: { event: updated.event, targetUrl: updated.targetUrl, isActive: updated.isActive }
        }
      });
      return reply.send(toJsonSafe(ok(webhookToResponse(updated))));
    }
    const row = webhooks.find((item) => item.projectId === projectId && item.id === webhookId);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
    Object.assign(row, {
      ...(body.event !== undefined ? { event: body.event } : {}),
      ...(body.targetUrl !== undefined ? { targetUrl: body.targetUrl } : {}),
      ...(body.secret !== undefined ? { secret: body.secret } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
    });
    return reply.send(toJsonSafe(ok(webhookToResponse(row))));
  });

  app.delete("/api/projects/:projectId/settings/webhooks/:webhookId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, webhookId } = webhookIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      const existing = await deps.prisma.webhookSubscription.findFirst({
        where: { id: webhookId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!existing) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
      await deps.prisma.webhookSubscription.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actor.id }
      });
      await deps.prisma.auditLog.create({
        data: {
          projectId,
          actorUserId: actor.id,
          action: "settings.webhook.deleted",
          entityType: "webhook",
          entityId: webhookId.toString()
        }
      });
      return reply.code(204).send();
    }
    const index = webhooks.findIndex((item) => item.projectId === projectId && item.id === webhookId);
    if (index === -1) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
    webhooks.splice(index, 1);
    return reply.code(204).send();
  });

  app.post("/api/projects/:projectId/settings/webhook-attempts/:attemptId/retry", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, attemptId } = webhookRetryParamSchema.parse(req.params);
    if (deps.prisma) {
      const existing = await deps.prisma.webhookDeliveryAttempt.findFirst({
        where: { id: attemptId, projectId },
        select: { id: true, webhookId: true, attemptNo: true }
      });
      if (!existing) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook attempt not found" });
      const updated = await deps.prisma.webhookDeliveryAttempt.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          attemptNo: { increment: 1 },
          error: null,
          responseStatus: null,
          responseBody: null,
          nextRetryAt: null
        }
      });
      return reply.send(toJsonSafe(ok(webhookAttemptToResponse(updated))));
    }
    const row = webhookAttempts.find((item) => item.projectId === projectId && item.id === attemptId);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook attempt not found" });
    row.status = "pending";
    row.attemptNo += 1;
    return reply.send(toJsonSafe(ok(webhookAttemptToResponse(row))));
  });

  app.get("/api/projects/:projectId/settings/audit-logs", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = auditLogsQuerySchema.parse(req.query ?? {});
    if (deps.prisma) {
      const where: Prisma.AuditLogWhereInput = {
        projectId,
        ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
        ...(query.entityType ? { entityType: { contains: query.entityType, mode: "insensitive" } } : {}),
        ...(query.entityId ? { entityId: { contains: query.entityId, mode: "insensitive" } } : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.createdFrom || query.createdTo
          ? {
              createdAt: {
                ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
                ...(query.createdTo ? { lte: new Date(query.createdTo) } : {})
              }
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                { action: { contains: query.q, mode: "insensitive" } },
                { entityType: { contains: query.q, mode: "insensitive" } },
                { entityId: { contains: query.q, mode: "insensitive" } }
              ]
            }
          : {})
      };
      const [total, rows] = await Promise.all([
        deps.prisma.auditLog.count({ where }),
        deps.prisma.auditLog.findMany({
          where,
          orderBy: { id: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize
        })
      ]);
      return reply.send(
        toJsonSafe({
          data: {
            items: rows.map((row: (typeof rows)[number]) => ({
              id: row.id,
              action: row.action,
              actorUserId: row.actorUserId,
              entityType: row.entityType,
              entityId: row.entityId,
              changes: row.changes,
              createdAt: row.createdAt
            })),
            filters: ["actorUserId", "entityType", "entityId", "action", "createdFrom", "createdTo", "q"],
            page: query.page,
            pageSize: query.pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.pageSize))
          }
        })
      );
    }
    const rows = [] as Array<{
      id: bigint;
      action: string;
      actorUserId: bigint | null;
      entityType: string;
      entityId: string;
      changes: Prisma.JsonValue | null;
      createdAt: Date;
    }>;
    return reply.send(
      toJsonSafe({
        data: {
          items: rows,
          filters: ["actorUserId", "entityType", "entityId", "action", "createdFrom", "createdTo", "q"],
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
          totalPages: 1
        }
      })
    );
  });

  app.get("/api/projects/:projectId/settings/audit-log-filters", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.send(ok({ actions: [], entityTypes: [] }));
    }
    const [actions, entityTypes] = await Promise.all([
      deps.prisma.auditLog.findMany({
        where: { projectId },
        distinct: ["action"],
        select: { action: true },
        orderBy: { id: "desc" },
        take: 100
      }),
      deps.prisma.auditLog.findMany({
        where: { projectId },
        distinct: ["entityType"],
        select: { entityType: true },
        orderBy: { id: "desc" },
        take: 100
      })
    ]);
    return reply.send(
      ok({
        actions: actions.map((row: (typeof actions)[number]) => row.action).sort(),
        entityTypes: entityTypes.map((row: (typeof entityTypes)[number]) => row.entityType).sort()
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
