import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import { randomBytes } from "node:crypto";

import { testStatuses, type TestStatus } from "../../domain/status.js";
import type { AuthService } from "../auth/auth.service.js";

export type CustomFieldRow = {
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

export type WebhookRow = {
  id: bigint;
  projectId: bigint;
  scope?: "project" | "global";
  event: string;
  targetUrl: string;
  secret: string;
  isActive: boolean;
};

export type CustomStatusRow = {
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

export type CaseTemplateRow = {
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

type CustomFieldType = "text" | "number" | "select" | "boolean";
type CustomFieldScope = "case" | "result";

const customFieldTypeSchema = z.enum(["text", "number", "select", "boolean"]);
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
  scope: z.enum(["project", "global"]).default("project"),
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
  "case.bulk_deleted",
  "case.bulk_moved",
  "case.bulk_copied",
  "case.bulk_updated",
  "case.bulk_archived",
  "case.bulk_restored",
  "case.reordered",
  "case.version_restored",
  "case.step_created",
  "case.step_updated",
  "case.step_deleted",
  "suite.*",
  "suite.created",
  "suite.updated",
  "suite.deleted",
  "section.*",
  "section.created",
  "section.updated",
  "section.moved",
  "section.deleted",
  "section.reordered",
  "section.copied",
  "run.*",
  "run.created",
  "run.updated",
  "run.assigned",
  "run.closed",
  "run.reopened",
  "run.tests_added",
  "run.test_removed",
  "run.rerun_created",
  "test.assigned",
  "result.*",
  "result.created",
  "result.failed",
  "result.bulk_created",
  "attachment.*",
  "attachment.created",
  "attachment.deleted",
  "defect.linked",
  "defect.unlinked",
  "defect.pushed",
  "milestone.*",
  "milestone.created",
  "milestone.updated",
  "milestone.completed",
  "milestone.deleted",
  "plan.*",
  "plan.created",
  "plan.updated",
  "plan.deleted",
  "plan.entry_created",
  "plan.entry_updated",
  "plan.entry_deleted",
  "configuration_group.*",
  "configuration_group.created",
  "configuration_group.updated",
  "configuration_group.deleted",
  "configuration.*",
  "configuration.created",
  "configuration.updated",
  "configuration.deleted",
  "requirement.*",
  "requirement.created",
  "requirement.updated",
  "requirement.deleted",
  "requirement.linked",
  "requirement.unlinked"
] as const;
const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  scope: z.enum(["project", "all"]).default("project"),
  action: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  actorUserId: z.coerce.bigint().optional(),
  actorEmail: z.string().trim().email().optional(),
  actionExact: z.coerce.boolean().optional(),
  entityTypeExact: z.coerce.boolean().optional(),
  changesContains: z.string().trim().min(1).optional(),
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
  scope?: string;
  event: string;
  targetUrl: string;
  secret: string;
  isActive: boolean;
  consecutiveFailures?: number;
  disabledAt?: Date | null;
  lastFailureAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: row.id,
    scope: row.scope === "global" ? "global" : "project",
    event: row.event,
    targetUrl: row.targetUrl,
    secretPrefix: `${row.secret.slice(0, 10)}...`,
    isActive: row.isActive,
    consecutiveFailures: row.consecutiveFailures ?? 0,
    disabledAt: row.disabledAt ?? null,
    lastFailureAt: row.lastFailureAt ?? null,
    autoDisabled: Boolean(row.disabledAt) && !row.isActive,
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

export type SettingsRouteDeps = { authService: AuthService; prisma?: PrismaClient };

export {
  customFields, customStatuses, caseTemplates, webhooks, webhookAttempts,
  customFieldCreateSchema, customFieldUpdateSchema, customFieldIdParamSchema,
  customStatusCreateSchema, customStatusUpdateSchema, customStatusIdParamSchema,
  caseTemplateCreateSchema, caseTemplateUpdateSchema, caseTemplateIdParamSchema,
  webhookCreateSchema, webhookUpdateSchema, webhookIdParamSchema, webhookRetryParamSchema, webhookEvents,
  auditLogsQuerySchema, addMemberSchema, updateMemberRoleSchema, memberIdParamSchema,
  enforceNotLastOwner, normalizeSystemName,
  fieldToResponse, fieldAuditChanges, statusToResponse, statusAuditChanges,
  templateToResponse, templateAuditChanges,
  newWebhookSecret, webhookToResponse, webhookAttemptToResponse, defaultStatusRows
};
