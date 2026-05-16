import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import type { AuthService } from "../auth/auth.service.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { AppError } from "../../common/errors/appError.js";
import { CasesService } from "./cases.service.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import {
  caseAttachmentBodySchema,
  caseAttachmentPresignBodySchema,
  bulkArchiveCasesSchema,
  bulkCopyCasesSchema,
  caseIdParamSchema,
  caseVersionIdParamSchema,
  caseVersionAttachmentDownloadParamSchema,
  bulkDeleteCasesSchema,
  bulkMoveCasesSchema,
  bulkUpdateCasesSchema,
  createCaseSchema,
  createCaseStepSchema,
  listCasesQuerySchema,
  positionCasesSchema,
  projectIdParamSchema,
  reorderCasesSchema,
  restoreCaseVersionSchema,
  sectionIdParamSchema,
  stepIdParamSchema,
  updateCaseSchema,
  updateCaseStepSchema
} from "./cases.schema.js";

function parseIfMatchVersion(value?: string | string[]): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const normalized = raw.replace(/^W\//i, "").replace(/"/g, "").trim();
  const num = Number(normalized);
  if (!Number.isInteger(num) || num < 1) return undefined;
  return num;
}

type ScalarCustomValue = string | number | boolean | null;
type CustomValues = Record<string, ScalarCustomValue>;

function asCustomValues(value: unknown): CustomValues | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CustomValues = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
      out[key] = item;
    }
  }
  return out;
}

function previewText(value: string, maxLength = 160) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trimEnd()}...` : value;
}

type AttachmentEntity = "case" | "case_step";

function mapAttachmentRow(row: {
  id: bigint;
  entityType: string;
  entityId: bigint;
  fileName: string;
  contentType: string | null;
  storagePath: string;
  fileSize: bigint | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    fileName: row.fileName,
    contentType: row.contentType ?? null,
    storagePath: row.storagePath,
    fileSize: row.fileSize ?? null,
    createdAt: row.createdAt
  };
}

async function caseAttachmentContext(prisma: PrismaClient, entityType: AttachmentEntity, entityId: bigint) {
  if (entityType === "case") {
    const row = await prisma.testCase.findFirst({
      where: { id: entityId, deletedAt: null },
      select: { id: true, projectId: true, title: true }
    });
    return row ? { projectId: row.projectId, caseId: row.id, title: row.title, stepOrder: null } : null;
  }

  const row = await prisma.testCaseStep.findFirst({
    where: { id: entityId, deletedAt: null },
    select: {
      id: true,
      stepOrder: true,
      testCase: { select: { id: true, projectId: true, title: true } }
    }
  });
  return row
    ? { projectId: row.testCase.projectId, caseId: row.testCase.id, title: row.testCase.title, stepOrder: row.stepOrder }
    : null;
}

async function listCaseEntityAttachments(prisma: PrismaClient | undefined, entityType: AttachmentEntity, entityId: bigint) {
  if (!prisma) return [];
  const rows = await prisma.attachment.findMany({
    where: { entityType, entityId, deletedAt: null },
    orderBy: { id: "desc" },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      fileName: true,
      contentType: true,
      storagePath: true,
      fileSize: true,
      createdAt: true
    }
  });
  return rows.map(mapAttachmentRow);
}

async function createCaseEntityAttachment(
  prisma: PrismaClient | undefined,
  input: {
    entityType: AttachmentEntity;
    entityId: bigint;
    userId: bigint;
    fileName: string;
    contentType?: string;
    storagePath?: string;
    fileSize?: bigint;
  }
) {
  const storagePath =
    input.storagePath ??
    `local://${input.entityType === "case" ? "cases" : "case-steps"}/${input.entityId.toString()}/${input.fileName}`;
  if (!prisma) {
    return {
      id: BigInt(Date.now()),
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.fileName,
      contentType: input.contentType ?? null,
      storagePath,
      fileSize: input.fileSize ?? null,
      createdAt: new Date()
    };
  }

  const context = await caseAttachmentContext(prisma, input.entityType, input.entityId);
  if (!context) {
    throw new AppError("NOT_FOUND", input.entityType === "case" ? "case not found" : "case step not found", 404);
  }
  const created = await prisma.attachment.create({
    data: {
      projectId: context.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.fileName,
      contentType: input.contentType,
      storagePath,
      fileSize: input.fileSize,
      createdBy: input.userId
    },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      fileName: true,
      contentType: true,
      storagePath: true,
      fileSize: true,
      createdAt: true
    }
  });
  await recordActivityEvent(prisma, {
    projectId: context.projectId,
    actorUserId: input.userId,
    entityType: "attachment",
    entityId: created.id,
    eventType: "attachment.created",
    title: input.entityType === "case" ? "Case attachment added" : "Case step attachment added",
    body: `${created.fileName} on ${context.title}.`,
    payload: {
      attachmentId: created.id.toString(),
      caseId: context.caseId.toString(),
      entityType: input.entityType,
      entityId: input.entityId.toString(),
      stepOrder: context.stepOrder,
      fileName: created.fileName
    }
  });
  return mapAttachmentRow(created);
}

async function syncRunsForCaseChange(
  compositionSync: import("../runs/runCompositionSync.service.js").RunCompositionSyncService | undefined,
  projectId: bigint | null | undefined,
  suiteId: bigint | null | undefined
) {
  if (!compositionSync || projectId == null || suiteId == null) return;
  try {
    await compositionSync.syncSuite(projectId, suiteId);
  } catch {
    // composition sync is best-effort after case mutations
  }
}

export async function registerCasesRoutes(
  app: FastifyInstance,
  deps: {
    casesService: CasesService;
    authService: AuthService;
    prisma?: PrismaClient;
    compositionSync?: import("../runs/runCompositionSync.service.js").RunCompositionSyncService;
  }
) {
  app.get("/api/projects/:projectId/cases", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const rawQuery = (req.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = paginationQuerySchema.parse(rawQuery);
    const query = listCasesQuerySchema.parse({
      projectId,
      suiteId: rawQuery.suiteId,
      sectionId: rawQuery.sectionId,
      q: rawQuery.q,
      priority: rawQuery.priority,
      caseType: rawQuery.caseType,
      automation: rawQuery.automation,
      refs: rawQuery.refs,
      labels: rawQuery.labels,
      estimate: rawQuery.estimate,
      sectionScope: rawQuery.sectionScope,
      state: rawQuery.state
    });
    return reply.send(toJsonSafe(paged(await deps.casesService.listCases(query), page, pageSize)));
  });

  app.get("/api/sections/:sectionId/cases", async (req, reply) => {
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const rawQuery = (req.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = paginationQuerySchema.parse(rawQuery);
    const query = listCasesQuerySchema.parse({
      sectionId,
      q: rawQuery.q,
      priority: rawQuery.priority,
      caseType: rawQuery.caseType,
      automation: rawQuery.automation,
      refs: rawQuery.refs,
      labels: rawQuery.labels,
      estimate: rawQuery.estimate,
      sectionScope: rawQuery.sectionScope,
      state: rawQuery.state
    });
    return reply.send(toJsonSafe(paged(await deps.casesService.listCases(query), page, pageSize)));
  });

  app.post("/api/sections/:sectionId/cases", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body = createCaseSchema.parse({
      sectionId,
      title: raw.title,
      priority: raw.priority,
      caseType: raw.caseType,
      preconditions: raw.preconditions,
      refs: raw.refs,
      customValues: raw.customValues
    });
    try {
      const user = await getAuthenticatedUser(req, deps);
      const customValues = await deps.casesService.validateCaseCustomValues(
        deps.prisma,
        await deps.casesService.projectIdForSection(deps.prisma, sectionId),
        asCustomValues(body.customValues) ?? {}
      );
      const created = await deps.casesService.createCase({ ...body, customValues });
      if (created.projectId) {
        await recordActivityEvent(deps.prisma, {
          projectId: created.projectId,
          actorUserId: user.id,
          entityType: "case",
          entityId: created.id,
          eventType: "case.created",
          title: "Test case created",
          body: created.title,
          payload: { caseId: created.id.toString() }
        });
      }
      await syncRunsForCaseChange(deps.compositionSync, created.projectId, created.suiteId);
      return reply.send(toJsonSafe(ok(created)));
    } catch (e) {
      const customFieldError = deps.casesService.customFieldErrorResponse(e);
      if (customFieldError) return reply.code(400).send(customFieldError);
      throw e;
    }
  });

  app.get("/api/cases/:caseId", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(await deps.casesService.getCase(caseId))));
  });

  app.get("/api/cases/:caseId/attachments", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(await listCaseEntityAttachments(deps.prisma, "case", caseId)));
  });

  app.post("/api/cases/:caseId/attachments", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = caseAttachmentBodySchema.parse(req.body ?? {});
    const created = await createCaseEntityAttachment(deps.prisma, {
      entityType: "case",
      entityId: caseId,
      userId: user.id,
      fileName: body.fileName,
      contentType: body.contentType,
      storagePath: body.storagePath,
      fileSize: body.fileSize
    });
    return reply.send(toJsonSafe(created));
  });

  app.post("/api/cases/:caseId/attachments/presign", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = caseAttachmentPresignBodySchema.parse(req.body ?? {});
    const now = Date.now();
    const storagePath = `cases/${caseId.toString()}/${now}-${body.fileName}`;
    return reply.send(
      toJsonSafe({
        data: {
          storagePath,
          uploadUrl: `https://storage.local/upload/${encodeURIComponent(storagePath)}`,
          method: "PUT",
          headers: { "content-type": body.contentType ?? "application/octet-stream" },
          expiresAt: new Date(now + 10 * 60 * 1000)
        }
      })
    );
  });

  app.post("/api/projects/:projectId/cases/bulk-delete", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = bulkDeleteCasesSchema.parse(req.body ?? {});
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedCaseIds(projectId, body.caseIds);
    const result = await deps.casesService.bulkDeleteCases(scopedIds);
    const items = [
      ...result.items,
      ...outOfScope.map((caseId) => ({ caseId, success: false, error: "NOT_FOUND" }))
    ];
    const deleted = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;

    if (deleted > 0) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: "bulk-delete",
        eventType: "case.bulk_deleted",
        title: "Test cases bulk deleted",
        body: `${deleted} test case${deleted === 1 ? "" : "s"} deleted`,
        payload: { caseIds: items.filter((item) => item.success).map((item) => item.caseId.toString()) }
      });
    }

    return reply.send(toJsonSafe(ok({ requested: body.caseIds.length, deleted, failed, items })));
  });

  app.post("/api/projects/:projectId/cases/bulk-move", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = bulkMoveCasesSchema.parse(req.body ?? {});
    await deps.casesService.assertProjectScopedSection(projectId, body.targetSectionId);
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedCaseIds(projectId, body.caseIds);
    const result = await deps.casesService.bulkMoveCases(scopedIds, body.targetSectionId);
    const items = [
      ...result.items,
      ...outOfScope.map((caseId) => ({ caseId, success: false, error: "NOT_FOUND" }))
    ];
    const moved = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;

    if (moved > 0) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: "bulk-move",
        eventType: "case.bulk_moved",
        title: "Test cases bulk moved",
        body: `${moved} test case${moved === 1 ? "" : "s"} moved`,
        payload: {
          targetSectionId: body.targetSectionId.toString(),
          caseIds: items.filter((item) => item.success).map((item) => item.caseId.toString())
        }
      });
    }

    return reply.send(
      toJsonSafe(ok({ requested: body.caseIds.length, moved, failed, targetSectionId: body.targetSectionId, items }))
    );
  });

  app.post("/api/projects/:projectId/cases/bulk-copy", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = bulkCopyCasesSchema.parse(req.body ?? {});
    await deps.casesService.assertProjectScopedSection(projectId, body.targetSectionId);
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedCaseIds(projectId, body.caseIds);
    const result = await deps.casesService.bulkCopyCases(scopedIds, body.targetSectionId);
    const items = [
      ...result.items,
      ...outOfScope.map((caseId) => ({ sourceCaseId: caseId, copiedCaseId: null, success: false, error: "NOT_FOUND" }))
    ];
    const copied = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;

    if (copied > 0) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: "bulk-copy",
        eventType: "case.bulk_copied",
        title: "Test cases bulk copied",
        body: `${copied} test case${copied === 1 ? "" : "s"} copied`,
        payload: {
          targetSectionId: body.targetSectionId.toString(),
          sourceCaseIds: items.filter((item) => item.success).map((item) => item.sourceCaseId.toString()),
          copiedCaseIds: items
            .filter((item) => item.success && item.copiedCaseId)
            .map((item) => item.copiedCaseId!.toString())
        }
      });
    }

    return reply.send(
      toJsonSafe(ok({ requested: body.caseIds.length, copied, failed, targetSectionId: body.targetSectionId, items }))
    );
  });

  app.post("/api/projects/:projectId/cases/bulk-update", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = bulkUpdateCasesSchema.parse(req.body ?? {});
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedCaseIds(projectId, body.caseIds);
    const result = await deps.casesService.bulkUpdateCases(scopedIds, body.patch);
    const items = [
      ...result.items,
      ...outOfScope.map((caseId) => ({ caseId, success: false, error: "NOT_FOUND" }))
    ];
    const updated = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;

    if (updated > 0) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: "bulk-update",
        eventType: "case.bulk_updated",
        title: "Test cases bulk updated",
        body: `${updated} test case${updated === 1 ? "" : "s"} updated`,
        payload: {
          patch: body.patch,
          caseIds: items.filter((item) => item.success).map((item) => item.caseId.toString())
        }
      });
    }

    return reply.send(toJsonSafe(ok({ requested: body.caseIds.length, updated, failed, patch: body.patch, items })));
  });

  app.post("/api/projects/:projectId/cases/bulk-archive", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = bulkArchiveCasesSchema.parse(req.body ?? {});
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedCaseIds(projectId, body.caseIds);
    const result = await deps.casesService.bulkArchiveCases(scopedIds, body.archived);
    const items = [
      ...result.items,
      ...outOfScope.map((caseId) => ({ caseId, success: false, error: "NOT_FOUND" }))
    ];
    const changed = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;

    if (changed > 0) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: body.archived ? "bulk-archive" : "bulk-restore",
        eventType: body.archived ? "case.bulk_archived" : "case.bulk_restored",
        title: body.archived ? "Test cases bulk archived" : "Test cases bulk restored",
        body: `${changed} test case${changed === 1 ? "" : "s"} ${body.archived ? "archived" : "restored"}`,
        payload: {
          archived: body.archived,
          caseIds: items.filter((item) => item.success).map((item) => item.caseId.toString())
        }
      });
    }

    return reply.send(
      toJsonSafe(ok({ requested: body.caseIds.length, changed, failed, archived: body.archived, items }))
    );
  });

  app.post("/api/projects/:projectId/cases/reorder", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = reorderCasesSchema.parse(req.body ?? {});
    const result = await deps.casesService.reorderCasesInSection(projectId, body.sectionId, body.orderedCaseIds);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "case",
      entityId: "reorder",
      eventType: "case.reordered",
      title: "Test cases reordered",
      body: `${result.updated} test case${result.updated === 1 ? "" : "s"} ordered`,
      payload: {
        sectionId: body.sectionId.toString(),
        orderedCaseIds: result.orderedCaseIds.map((caseId) => caseId.toString())
      }
    });
    return reply.send(toJsonSafe(ok(result)));
  });

  app.post("/api/projects/:projectId/cases/position", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = positionCasesSchema.parse(req.body ?? {});
    const result = await deps.casesService.positionCasesInSection(projectId, body);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "case",
      entityId: "position",
      eventType: "case.reordered",
      title: "Test cases repositioned",
      body: `${result.movedCaseIds.length} test case${result.movedCaseIds.length === 1 ? "" : "s"} moved in section order`,
      payload: {
        sectionId: body.sectionId.toString(),
        movedCaseIds: result.movedCaseIds.map((caseId) => caseId.toString()),
        beforeCaseId: body.beforeCaseId?.toString() ?? null,
        afterCaseId: body.afterCaseId?.toString() ?? null,
        orderedCaseIds: result.orderedCaseIds.map((caseId) => caseId.toString())
      }
    });
    return reply.send(toJsonSafe(ok(result)));
  });

  app.get("/api/cases/:caseId/versions", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const rows = await deps.casesService.listCaseVersions(caseId);
    return reply.send(toJsonSafe(paged(rows, page, pageSize)));
  });

  app.get("/api/cases/:caseId/versions/:versionId", async (req, reply) => {
    const { caseId, versionId } = caseVersionIdParamSchema.parse(req.params);
    const row = await deps.casesService.getCaseVersion(caseId, versionId);
    return reply.send(toJsonSafe(ok(row)));
  });

  app.get("/api/cases/:caseId/versions/:versionNo/attachments/:attachmentId/download", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { caseId, versionNo, attachmentId } = caseVersionAttachmentDownloadParamSchema.parse(req.params);
    const download = await deps.casesService.getCaseVersionAttachmentDownload(caseId, versionNo, attachmentId);
    return reply.send(toJsonSafe(ok(download)));
  });

  app.post("/api/cases/:caseId/versions/:versionId/restore", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId, versionId } = caseVersionIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = restoreCaseVersionSchema.parse(req.body ?? {});
    const ifMatchVersion = parseIfMatchVersion(req.headers["if-match"]);
    const restored = await deps.casesService.restoreCaseVersion(caseId, versionId, body.expectedVersion ?? ifMatchVersion);
    if (restored.projectId) {
      await recordActivityEvent(deps.prisma, {
        projectId: restored.projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: restored.id,
        eventType: "case.version_restored",
        title: "Test case version restored",
        body: restored.title,
        payload: { caseId: restored.id.toString(), versionId: versionId.toString() }
      });
    }
    return reply.send(toJsonSafe(ok(restored)));
  });

  app.patch("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = updateCaseSchema.parse(req.body);
    const ifMatchVersion = parseIfMatchVersion(req.headers["if-match"]);
    const customValues = await deps.casesService.validateCaseCustomValues(
      deps.prisma,
      await deps.casesService.projectIdForCase(deps.prisma, caseId),
      asCustomValues(body.customValues)
    ).catch((e) => {
      const customFieldError = deps.casesService.customFieldErrorResponse(e);
      if (customFieldError) return customFieldError;
      throw e;
    });
    if (customValues && "code" in customValues) return reply.code(400).send(customValues);
    const updated = await deps.casesService.updateCase(caseId, {
      ...body,
      customValues,
      expectedVersion: body.expectedVersion ?? ifMatchVersion
    });
    if (updated.projectId) {
      await recordActivityEvent(deps.prisma, {
        projectId: updated.projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: updated.id,
        eventType: "case.updated",
        title: "Test case updated",
        body: updated.title,
        payload: { caseId: updated.id.toString() }
      });
    }
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.delete("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const projectId = await deps.casesService.projectIdForCase(deps.prisma, caseId);
    await deps.casesService.deleteCase(caseId);
    if (projectId) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: caseId,
        eventType: "case.deleted",
        title: "Test case deleted"
      });
    }
    return reply.status(204).send();
  });

  app.post("/api/cases/:caseId/steps", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = createCaseStepSchema.parse(req.body ?? {});
    const created = await deps.casesService.createCaseStep(caseId, body);
    const projectId = await deps.casesService.projectIdForCase(deps.prisma, caseId);
    if (projectId && deps.prisma) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: caseId,
        eventType: "case.step_created",
        title: "Case step added",
        body: previewText(created.content),
        payload: {
          caseId: caseId.toString(),
          stepId: created.id.toString(),
          stepOrder: created.stepOrder
        }
      });
    }
    return reply.send(toJsonSafe(ok(created)));
  });

  app.get("/api/case-steps/:stepId/attachments", async (req, reply) => {
    const { stepId } = stepIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(await listCaseEntityAttachments(deps.prisma, "case_step", stepId)));
  });

  app.post("/api/case-steps/:stepId/attachments", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = caseAttachmentBodySchema.parse(req.body ?? {});
    const created = await createCaseEntityAttachment(deps.prisma, {
      entityType: "case_step",
      entityId: stepId,
      userId: user.id,
      fileName: body.fileName,
      contentType: body.contentType,
      storagePath: body.storagePath,
      fileSize: body.fileSize
    });
    return reply.send(toJsonSafe(created));
  });

  app.post("/api/case-steps/:stepId/attachments/presign", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    const body = caseAttachmentPresignBodySchema.parse(req.body ?? {});
    const now = Date.now();
    const storagePath = `case-steps/${stepId.toString()}/${now}-${body.fileName}`;
    return reply.send(
      toJsonSafe({
        data: {
          storagePath,
          uploadUrl: `https://storage.local/upload/${encodeURIComponent(storagePath)}`,
          method: "PUT",
          headers: { "content-type": body.contentType ?? "application/octet-stream" },
          expiresAt: new Date(now + 10 * 60 * 1000)
        }
      })
    );
  });

  app.patch("/api/case-steps/:stepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    const body = updateCaseStepSchema.parse(req.body ?? {});
    let stepContext: { caseId: bigint; projectId: bigint } | null = null;
    if (deps.prisma) {
      const row = await deps.prisma.testCaseStep.findFirst({
        where: { id: stepId, deletedAt: null },
        select: { caseId: true, testCase: { select: { projectId: true } } }
      });
      if (row) stepContext = { caseId: row.caseId, projectId: row.testCase.projectId };
    }
    const updated = await deps.casesService.updateCaseStep(stepId, body);
    if (stepContext && deps.prisma) {
      await recordActivityEvent(deps.prisma, {
        projectId: stepContext.projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: stepContext.caseId,
        eventType: "case.step_updated",
        title: "Case step updated",
        body: previewText(updated.content),
        payload: { caseId: stepContext.caseId.toString(), stepId: stepId.toString() }
      });
    }
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.delete("/api/case-steps/:stepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    let stepContext: { caseId: bigint; projectId: bigint } | null = null;
    if (deps.prisma) {
      const row = await deps.prisma.testCaseStep.findFirst({
        where: { id: stepId, deletedAt: null },
        select: { caseId: true, testCase: { select: { projectId: true } } }
      });
      if (row) stepContext = { caseId: row.caseId, projectId: row.testCase.projectId };
    }
    await deps.casesService.deleteCaseStep(stepId);
    if (stepContext && deps.prisma) {
      await recordActivityEvent(deps.prisma, {
        projectId: stepContext.projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: stepContext.caseId,
        eventType: "case.step_deleted",
        title: "Case step removed",
        body: `Step ${stepId.toString()}`,
        payload: { caseId: stepContext.caseId.toString(), stepId: stepId.toString() }
      });
    }
    return reply.status(204).send();
  });
}
