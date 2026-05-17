import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok } from "../../common/utils/http.js";
import type { ResultsService } from "./results.service.js";
import { resultIdParamSchema, resultSchema, testIdParamSchema } from "./results.schema.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { AppError } from "../../common/errors/appError.js";
import {
  getAuthenticatedUser,
  requireProjectMutationRole,
  requireProjectPermission
} from "../../common/middlewares/authorization.js";
import {
  assertAttachmentStoragePathAllowed,
  buildAttachmentStoragePath,
  createSignedDownloadTarget,
  createSignedUploadTarget
} from "../../domain/attachmentStorage.js";
import { normalizeDefectProvider } from "../../domain/defectIntegrationValidation.js";
import { appendCustomFieldsToDescription } from "../../domain/defectPushFields.js";
import { syncProviderIssueStatus } from "../../domain/defectProviderApi.js";
import { loadDefectIntegration } from "../integrations/defectIntegration.service.js";
import { resolveDefectPushOutcome, toDefectApiConfig } from "../integrations/defectIssue.service.js";
import {
  findInMemoryResultDefectLink,
  listInMemoryResultDefectLinks,
  updateInMemoryResultDefectLinkStatus,
  upsertInMemoryResultDefectLink
} from "./resultDefectLinks.memory.js";

function toDefectLinkResponse(row: {
  id: bigint;
  defectKey: string;
  url: string | null;
  remoteStatus?: string | null;
  remoteStatusLabel?: string | null;
  remoteStatusSyncedAt?: Date | null;
  providerIssueId?: string | null;
  createMode?: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    defectKey: row.defectKey,
    url: row.url ?? null,
    remoteStatus: row.remoteStatus ?? null,
    remoteStatusLabel: row.remoteStatusLabel ?? null,
    remoteStatusSyncedAt: row.remoteStatusSyncedAt ?? null,
    providerIssueId: row.providerIssueId ?? null,
    createMode: row.createMode ?? null,
    createdAt: row.createdAt
  };
}
import {
  requireAttachmentRoutePermission,
  requireProjectPermissionForProject
} from "../attachments/attachmentAccess.js";
import { softDeleteAttachmentWithTombstone } from "../attachments/attachmentLifecycle.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  rejectResultRowMutation,
  RESULT_CORRECTION_POLICY
} from "../../domain/resultCorrectionPolicy.js";
import { resolveProjectAccess } from "../permissions/projectAccess.service.js";
import { loadActiveCustomFields, visibilityContextFromAccess } from "../settings/customFieldAccess.js";
import type { AuthService } from "../auth/auth.service.js";
import { recordActivityEvent, recordResultActivity } from "../activity/activity.service.js";
import { recordAuditLog } from "../settings/auditLog.service.js";
import {
  filterResultCustomValuesForRead,
  projectIdForTestInstance,
  resultCustomFieldErrorResponse,
  validateResultCustomValues
} from "./resultCustomValues.js";

const attachmentBodySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().optional(),
  storagePath: z.string().optional(),
  fileSize: z.coerce.bigint().optional()
});
const createAttachmentBodySchema = z.object({
  resultId: z.coerce.bigint().optional(),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().optional(),
  storagePath: z.string().trim().min(1),
  fileSize: z.coerce.bigint().optional()
});
const attachmentIdParamSchema = z.object({
  attachmentId: z.coerce.bigint()
});
const attachmentPresignBodySchema = z.object({
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1).optional(),
  fileSize: z.coerce.bigint().positive().optional()
});

const defectBodySchema = z.object({
  defectKey: z.string().min(1),
  url: z.string().url().optional()
});

const defectLinkIdParamSchema = z.object({
  resultId: z.coerce.bigint(),
  defectLinkId: z.coerce.bigint()
});

const defectPushBodySchema = z.object({
  defectKey: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  customFields: z.record(z.string(), z.string()).optional()
});

async function resultActivityContext(prisma: PrismaClient, resultId: bigint) {
  return prisma.testResult.findUnique({
    where: { id: resultId },
    select: {
      id: true,
      instance: {
        select: {
          id: true,
          caseId: true,
          titleSnapshot: true,
          run: { select: { id: true, projectId: true, name: true } }
        }
      }
    }
  });
}

async function recordAttachmentActivity(
  prisma: PrismaClient,
  input: {
    resultId: bigint;
    attachmentId: bigint;
    actorUserId: bigint;
    fileName: string;
    eventType: "attachment.created" | "attachment.deleted";
  }
) {
  const context = await resultActivityContext(prisma, input.resultId);
  if (!context) return;
  await recordActivityEvent(prisma, {
    projectId: context.instance.run.projectId,
    actorUserId: input.actorUserId,
    entityType: "attachment",
    entityId: input.attachmentId,
    eventType: input.eventType,
    title: input.eventType === "attachment.created" ? "Attachment added" : "Attachment removed",
    body: `${input.fileName} on ${context.instance.titleSnapshot}.`,
    payload: {
      attachmentId: input.attachmentId.toString(),
      resultId: input.resultId.toString(),
      runId: context.instance.run.id.toString(),
      runName: context.instance.run.name,
      testId: context.instance.id.toString(),
      caseId: context.instance.caseId.toString(),
      fileName: input.fileName
    }
  });
}

export async function registerResultsRoutes(
  app: FastifyInstance,
  deps: { resultsService: ResultsService; prisma?: PrismaClient; authService: AuthService }
) {
  app.get("/api/projects/:projectId/result-correction-policy", async (req, reply) => {
    await requireProjectPermission(req, deps, "runs.read");
    projectIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(RESULT_CORRECTION_POLICY)));
  });

  const blockResultRowMutation = async () => {
    rejectResultRowMutation();
  };
  app.patch("/api/results/:resultId", blockResultRowMutation);
  app.put("/api/results/:resultId", blockResultRowMutation);
  app.delete("/api/results/:resultId", blockResultRowMutation);

  app.post("/api/attachments", async (req, reply) => {
    const body = createAttachmentBodySchema.parse(req.body ?? {});
    if (!deps.prisma) {
      return reply.send(
        toJsonSafe({
          data: {
            id: BigInt(Date.now()),
            resultId: body.resultId ?? null,
            fileName: body.fileName,
            contentType: body.contentType ?? null,
            storagePath: body.storagePath,
            fileSize: body.fileSize ?? null,
            createdAt: new Date()
          }
        })
      );
    }
    const user = await getAuthenticatedUser(req, deps);
    if (!body.resultId) {
      throw new AppError("VALIDATION_ERROR", "resultId is required", 400);
    }
    const result = await deps.prisma.testResult.findUnique({
      where: { id: body.resultId },
      include: { instance: { include: { run: true } } }
    });
    if (!result) {
      throw new AppError("NOT_FOUND", "result not found", 404);
    }
    await requireProjectPermissionForProject(req, deps, result.instance.run.projectId, "results.write");
    const storagePath = body.storagePath;
    assertAttachmentStoragePathAllowed({
      projectId: result.instance.run.projectId,
      entity: "results",
      entityId: body.resultId,
      storagePath
    });
    const created = await deps.prisma.attachment.create({
      data: {
        projectId: result.instance.run.projectId,
        entityType: "result",
        entityId: body.resultId,
        resultId: body.resultId,
        fileName: body.fileName,
        contentType: body.contentType,
        storagePath,
        fileSize: body.fileSize,
        createdBy: user.id
      }
    });
    await recordAttachmentActivity(deps.prisma, {
      resultId: body.resultId,
      attachmentId: created.id,
      actorUserId: user.id,
      fileName: created.fileName,
      eventType: "attachment.created"
    });
    return reply.send(
      toJsonSafe({
        data: {
          id: created.id,
          resultId: created.resultId ?? null,
          fileName: created.fileName,
          contentType: created.contentType ?? null,
          storagePath: created.storagePath,
          fileSize: created.fileSize ?? null,
          createdAt: created.createdAt
        }
      })
    );
  });

  app.post("/api/tests/:testId/results", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'results.write' });
    const user = await getAuthenticatedUser(req, deps);
    const params = testIdParamSchema.parse(req.params);
    const body = resultSchema.parse(req.body);
    const projectId = await projectIdForTestInstance(deps.prisma, params.testId);
    let visibility;
    if (deps.prisma && projectId) {
      const access = await resolveProjectAccess(deps.prisma, user.id, projectId);
      if (access) {
        visibility = visibilityContextFromAccess(access, "result");
      }
    }
    try {
      body.customValues = await validateResultCustomValues(
        deps.prisma,
        projectId,
        body.customValues,
        visibility
      );
    } catch (e) {
      const customFieldError = resultCustomFieldErrorResponse(e);
      if (customFieldError) return reply.code(400).send(customFieldError);
      throw e;
    }
    const created = await deps.resultsService.addResultToTestInstance(params.testId, body);
    await recordResultActivity(deps.prisma, { resultId: created.id, actorUserId: user.id });
    return reply.send(toJsonSafe(created));
  });

  app.get("/api/tests/:testId/results", async (req, reply) => {
    const params = testIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const { items, total } = await deps.resultsService.listResultsForTestInstancePage(params.testId, page, pageSize);
    let filteredItems = items;
    if (deps.prisma) {
      const projectId = await projectIdForTestInstance(deps.prisma, params.testId);
      if (projectId) {
        const user = await getAuthenticatedUser(req, deps);
        const access = await resolveProjectAccess(deps.prisma, user.id, projectId);
        if (access) {
          const ctx = visibilityContextFromAccess(access, "result");
          const fields = await loadActiveCustomFields(deps.prisma, projectId, "result");
          filteredItems = items.map((item) => ({
            ...item,
            customValues: item.customValues
              ? filterResultCustomValuesForRead(item.customValues, fields, ctx)
              : item.customValues
          }));
        }
      }
    }
    return reply.send(
      toJsonSafe(
        ok({
          items: filteredItems,
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize))
        })
      )
    );
  });

  app.get("/api/results/:resultId/steps", async (req, reply) => {
    const params = resultIdParamSchema.parse(req.params);
    const steps = await deps.resultsService.listResultStepsByResultId(params.resultId);
    return reply.send(toJsonSafe(steps));
  });

  app.get("/api/results/:resultId/scenarios", async (req, reply) => {
    const params = resultIdParamSchema.parse(req.params);
    const scenarios = await deps.resultsService.listResultScenariosByResultId(params.resultId);
    return reply.send(toJsonSafe(scenarios));
  });

  app.get("/api/results/:resultId/attachments", async (req, reply) => {
    const params = resultIdParamSchema.parse(req.params);
    await requireAttachmentRoutePermission(req, deps, "read");
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.attachment.findMany({
      where: {
        entityType: "result",
        entityId: params.resultId,
        resultId: params.resultId,
        deletedAt: null
      },
      orderBy: { id: "desc" }
    });
    return reply.send(
      toJsonSafe(
        rows.map((row: (typeof rows)[number]) => ({
          id: row.id,
          fileName: row.fileName,
          contentType: row.contentType ?? null,
          storagePath: row.storagePath,
          fileSize: row.fileSize ?? null,
          createdAt: row.createdAt
        }))
      )
    );
  });

  app.post("/api/results/:resultId/attachments", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'results.write' });
    const params = resultIdParamSchema.parse(req.params);
    const body = attachmentBodySchema.parse(req.body);
    if (!deps.prisma) {
      return reply.send(
        toJsonSafe({
          id: BigInt(Date.now()),
          fileName: body.fileName,
          contentType: body.contentType ?? null,
          storagePath: body.storagePath ?? `local://results/${params.resultId.toString()}/${body.fileName}`,
          fileSize: body.fileSize ?? null,
          createdAt: new Date()
        })
      );
    }
    const user = await getAuthenticatedUser(req, deps);
    const result = await deps.prisma.testResult.findUnique({
      where: { id: params.resultId },
      include: { instance: { include: { run: true } } }
    });
    if (!result) {
      throw new AppError("NOT_FOUND", "result not found", 404);
    }
    const storagePath =
      body.storagePath ??
      buildAttachmentStoragePath({
        projectId: result.instance.run.projectId,
        entity: "results",
        entityId: params.resultId,
        fileName: body.fileName
      });
    assertAttachmentStoragePathAllowed({
      projectId: result.instance.run.projectId,
      entity: "results",
      entityId: params.resultId,
      storagePath
    });
    const created = await deps.prisma.attachment.create({
      data: {
        projectId: result.instance.run.projectId,
        entityType: "result",
        entityId: params.resultId,
        resultId: params.resultId,
        fileName: body.fileName,
        contentType: body.contentType,
        storagePath,
        fileSize: body.fileSize,
        createdBy: user.id
      }
    });
    await recordAttachmentActivity(deps.prisma, {
      resultId: params.resultId,
      attachmentId: created.id,
      actorUserId: user.id,
      fileName: created.fileName,
      eventType: "attachment.created"
    });
    return reply.send(
      toJsonSafe({
        id: created.id,
        fileName: created.fileName,
        contentType: created.contentType ?? null,
        storagePath: created.storagePath,
        fileSize: created.fileSize ?? null,
        createdAt: created.createdAt
      })
    );
  });

  app.post("/api/results/:resultId/attachments/presign", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "results.write" });
    const params = resultIdParamSchema.parse(req.params);
    const body = attachmentPresignBodySchema.parse(req.body ?? {});
    if (!deps.prisma) {
      throw new AppError("NOT_FOUND", "result not found", 404);
    }
    const result = await deps.prisma.testResult.findUnique({
      where: { id: params.resultId },
      select: { instance: { select: { run: { select: { projectId: true } } } } }
    });
    if (!result) {
      throw new AppError("NOT_FOUND", "result not found", 404);
    }
    const storagePath = buildAttachmentStoragePath({
      projectId: result.instance.run.projectId,
      entity: "results",
      entityId: params.resultId,
      fileName: body.fileName
    });
    return reply.send(toJsonSafe({ data: createSignedUploadTarget(storagePath, body.contentType) }));
  });

  app.get("/api/attachments/:attachmentId", async (req, reply) => {
    const params = attachmentIdParamSchema.parse(req.params);
    await requireAttachmentRoutePermission(req, deps, "read");
    if (!deps.prisma) {
      return reply.send(
        toJsonSafe({
          data: {
            id: params.attachmentId,
            fileName: "attachment.bin",
            contentType: "application/octet-stream",
            storagePath: `local://attachments/${params.attachmentId.toString()}`,
            fileSize: null,
            createdAt: new Date()
          }
        })
      );
    }
    const row = await deps.prisma.attachment.findFirst({
      where: { id: params.attachmentId, deletedAt: null }
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "attachment not found", 404);
    }
    return reply.send(
      toJsonSafe({
        data: {
          id: row.id,
          fileName: row.fileName,
          contentType: row.contentType ?? null,
          storagePath: row.storagePath,
          fileSize: row.fileSize ?? null,
          createdAt: row.createdAt
        }
      })
    );
  });

  app.delete("/api/attachments/:attachmentId", async (req, reply) => {
    const params = attachmentIdParamSchema.parse(req.params);
    await requireAttachmentRoutePermission(req, deps, "write");
    if (!deps.prisma) {
      return reply.status(204).send();
    }
    const user = await getAuthenticatedUser(req, deps);
    const found = await softDeleteAttachmentWithTombstone(deps.prisma, params.attachmentId, user.id);
    if (found.resultId) {
      await recordAttachmentActivity(deps.prisma, {
        resultId: found.resultId,
        attachmentId: found.id,
        actorUserId: user.id,
        fileName: found.fileName,
        eventType: "attachment.deleted"
      });
    }
    return reply.status(204).send();
  });

  app.post("/api/attachments/:attachmentId/download-url", async (req, reply) => {
    const params = attachmentIdParamSchema.parse(req.params);
    await requireAttachmentRoutePermission(req, deps, "read");
    if (!deps.prisma) {
      const signed = createSignedDownloadTarget(`local://attachments/${params.attachmentId.toString()}`);
      return reply.send(
        toJsonSafe({
          data: {
            attachmentId: params.attachmentId,
            downloadUrl: signed.downloadUrl,
            expiresAt: signed.expiresAt
          }
        })
      );
    }
    const row = await deps.prisma.attachment.findFirst({
      where: { id: params.attachmentId, deletedAt: null },
      select: { id: true, storagePath: true }
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "attachment not found", 404);
    }
    const signed = createSignedDownloadTarget(row.storagePath);
    return reply.send(
      toJsonSafe({
        data: {
          attachmentId: row.id,
          downloadUrl: signed.downloadUrl,
          expiresAt: signed.expiresAt
        }
      })
    );
  });

  app.get("/api/results/:resultId/defects", async (req, reply) => {
    const params = resultIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.send(
        toJsonSafe(
          listInMemoryResultDefectLinks(params.resultId).map((row) => toDefectLinkResponse(row))
        )
      );
    }
    const rows = await deps.prisma.resultDefectLink.findMany({
      where: { resultId: params.resultId, deletedAt: null },
      orderBy: { id: "desc" }
    });
    return reply.send(
      toJsonSafe(
        rows.map((row: (typeof rows)[number]) => toDefectLinkResponse(row))
      )
    );
  });

  app.post("/api/results/:resultId/defects", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'results.write' });
    const params = resultIdParamSchema.parse(req.params);
    const body = defectBodySchema.parse(req.body);
    if (!deps.prisma) {
      return reply.send(
        toJsonSafe({
          id: BigInt(Date.now()),
          defectKey: body.defectKey,
          url: body.url ?? null,
          createdAt: new Date()
        })
      );
    }
    const user = await getAuthenticatedUser(req, deps);
    const result = await deps.prisma.testResult.findUnique({
      where: { id: params.resultId },
      select: { id: true }
    });
    if (!result) {
      throw new AppError("NOT_FOUND", "result not found", 404);
    }
    const upserted = await deps.prisma.resultDefectLink.upsert({
      where: { resultId_defectKey: { resultId: params.resultId, defectKey: body.defectKey } },
      create: {
        resultId: params.resultId,
        defectKey: body.defectKey,
        url: body.url,
        createdBy: user.id
      },
      update: {
        deletedAt: null,
        url: body.url
      }
    });
    const context = await deps.prisma.testResult.findUnique({
      where: { id: params.resultId },
      select: {
        instance: {
          select: {
            id: true,
            caseId: true,
            assignedTo: true,
            run: { select: { id: true, projectId: true } },
            titleSnapshot: true
          }
        }
      }
    });
    if (context) {
      await recordAuditLog(deps.prisma, {
        projectId: context.instance.run.projectId,
        actorUserId: user.id,
        action: "defect.linked",
        entityType: "result",
        entityId: params.resultId,
        changes: {
          defectKey: body.defectKey,
          defectLinkId: upserted.id.toString(),
          runId: context.instance.run.id.toString(),
          testId: context.instance.id.toString(),
          caseId: context.instance.caseId.toString()
        }
      });
      await recordActivityEvent(deps.prisma, {
        projectId: context.instance.run.projectId,
        actorUserId: user.id,
        entityType: "result",
        entityId: params.resultId,
        eventType: "defect.linked",
        title: "Defect linked",
        body: `${body.defectKey} linked to ${context.instance.titleSnapshot}.`,
        payload: {
          resultId: params.resultId.toString(),
          defectKey: body.defectKey,
          defectLinkId: upserted.id.toString(),
          runId: context.instance.run.id.toString(),
          testId: context.instance.id.toString(),
          caseId: context.instance.caseId.toString(),
          assignedToUserId: context.instance.assignedTo?.toString() ?? null
        },
        notificationType: "activity"
      });
    }
    return reply.send(
      toJsonSafe({
        id: upserted.id,
        defectKey: upserted.defectKey,
        url: upserted.url ?? null,
        createdAt: upserted.createdAt
      })
    );
  });

  app.delete("/api/results/:resultId/defects/:defectLinkId", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'results.write' });
    const user = await getAuthenticatedUser(req, deps);
    const params = defectLinkIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.status(204).send();
    }
    const found = await deps.prisma.resultDefectLink.findFirst({
      where: { id: params.defectLinkId, resultId: params.resultId, deletedAt: null },
      select: {
        id: true,
        defectKey: true,
        result: {
          select: {
            instance: {
              select: {
                id: true,
                caseId: true,
                titleSnapshot: true,
                run: { select: { id: true, projectId: true } }
              }
            }
          }
        }
      }
    });
    if (!found) {
      throw new AppError("NOT_FOUND", "defect link not found", 404);
    }
    await deps.prisma.resultDefectLink.update({
      where: { id: params.defectLinkId },
      data: { deletedAt: new Date() }
    });
    const inst = found.result.instance;
    const projectId = inst.run.projectId;
    await recordAuditLog(deps.prisma, {
      projectId,
      actorUserId: user.id,
      action: "defect.unlinked",
      entityType: "result",
      entityId: params.resultId,
      changes: {
        defectLinkId: params.defectLinkId.toString(),
        defectKey: found.defectKey,
        runId: inst.run.id.toString(),
        testId: inst.id.toString(),
        caseId: inst.caseId.toString()
      }
    });
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "result",
      entityId: params.resultId,
      eventType: "defect.unlinked",
      title: "Defect unlinked",
      body: `${found.defectKey} removed from ${inst.titleSnapshot}.`,
      payload: {
        resultId: params.resultId.toString(),
        defectLinkId: params.defectLinkId.toString(),
        defectKey: found.defectKey,
        runId: inst.run.id.toString(),
        testId: inst.id.toString(),
        caseId: inst.caseId.toString()
      }
    });
    return reply.status(204).send();
  });

  app.post("/api/results/:resultId/defects/push", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'results.write' });
    const params = resultIdParamSchema.parse(req.params);
    const body = defectPushBodySchema.parse(req.body ?? {});
    const user = await getAuthenticatedUser(req, deps);
    if (!deps.prisma) {
      const context = await deps.resultsService.findResultPushContext(params.resultId);
      if (!context) {
        throw new AppError("NOT_FOUND", "result not found", 404);
      }
      const setting = await loadDefectIntegration(context.projectId, undefined);
      if (!setting.isEnabled) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Enable defect integration in project settings before pushing a defect",
          400
        );
      }
      const provider = normalizeDefectProvider(body.provider ?? setting.provider);
      const title =
        body.title?.trim() || `[${context.status}] ${context.titleSnapshot}`.slice(0, 240);
      const customFields = body.customFields ?? {};
      const description = appendCustomFieldsToDescription(
        body.description?.trim() ||
          [
            `Test: ${context.titleSnapshot}`,
            `Run: ${context.runName}`,
            `Result #${params.resultId.toString()} (${context.status})`,
            context.comment?.trim() ? `Comment: ${context.comment.trim()}` : null
          ]
            .filter(Boolean)
            .join("\n"),
        customFields
      );
      const outcome = await resolveDefectPushOutcome(setting, {
        title,
        description,
        defectKey: body.defectKey,
        customFields
      });
      const upserted = upsertInMemoryResultDefectLink({
        resultId: params.resultId,
        defectKey: outcome.defectKey,
        url: outcome.url,
        remoteStatus: outcome.remoteStatus,
        remoteStatusLabel: outcome.remoteStatusLabel,
        remoteStatusSyncedAt: outcome.remoteStatusSyncedAt,
        providerIssueId: outcome.providerIssueId,
        createMode: outcome.createMode
      });
      return reply.send(
        toJsonSafe({
          data: {
            id: upserted.id,
            provider,
            defectKey: upserted.defectKey,
            url: upserted.url ?? null,
            remoteStatus: upserted.remoteStatus,
            remoteStatusLabel: upserted.remoteStatusLabel,
            remoteStatusSyncedAt: upserted.remoteStatusSyncedAt,
            title,
            description,
            customFields
          }
        })
      );
    }

    const result = await deps.prisma.testResult.findUnique({
      where: { id: params.resultId },
      include: { instance: { include: { run: true } } }
    });
    if (!result) {
      throw new AppError("NOT_FOUND", "result not found", 404);
    }
    const setting = await loadDefectIntegration(result.instance.run.projectId, deps.prisma);
    if (!setting.isEnabled) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Enable defect integration in project settings before pushing a defect",
        400
      );
    }
    const provider = normalizeDefectProvider(body.provider ?? setting.provider);
    const title =
      body.title?.trim() || `[${result.status}] ${result.instance.titleSnapshot}`.slice(0, 240);
    const customFields = body.customFields ?? {};
    const description = appendCustomFieldsToDescription(
      body.description?.trim() ||
        [
          `Test: ${result.instance.titleSnapshot}`,
          `Run: ${result.instance.run.name}`,
          `Result #${params.resultId.toString()} (${result.status})`,
          result.comment?.trim() ? `Comment: ${result.comment.trim()}` : null
        ]
          .filter(Boolean)
          .join("\n"),
      customFields
    );
    const outcome = await resolveDefectPushOutcome(setting, {
      title,
      description,
      defectKey: body.defectKey,
      customFields
    });
    const upserted = await deps.prisma.resultDefectLink.upsert({
      where: { resultId_defectKey: { resultId: params.resultId, defectKey: outcome.defectKey } },
      create: {
        resultId: params.resultId,
        defectKey: outcome.defectKey,
        url: outcome.url,
        remoteStatus: outcome.remoteStatus,
        remoteStatusLabel: outcome.remoteStatusLabel,
        remoteStatusSyncedAt: outcome.remoteStatusSyncedAt,
        providerIssueId: outcome.providerIssueId,
        createMode: outcome.createMode,
        createdBy: user.id
      },
      update: {
        deletedAt: null,
        url: outcome.url,
        remoteStatus: outcome.remoteStatus,
        remoteStatusLabel: outcome.remoteStatusLabel,
        remoteStatusSyncedAt: outcome.remoteStatusSyncedAt,
        providerIssueId: outcome.providerIssueId,
        createMode: outcome.createMode
      }
    });
    await recordAuditLog(deps.prisma, {
      projectId: result.instance.run.projectId,
      actorUserId: user.id,
      action: "defect.pushed",
      entityType: "result",
      entityId: params.resultId,
      changes: {
        defectKey: outcome.defectKey,
        defectLinkId: upserted.id.toString(),
        provider,
        title,
        customFields,
        runId: result.instance.run.id.toString(),
        testId: result.instance.id.toString(),
        caseId: result.instance.caseId.toString()
      }
    });
    await recordActivityEvent(deps.prisma, {
      projectId: result.instance.run.projectId,
      actorUserId: user.id,
      entityType: "result",
      entityId: params.resultId,
      eventType: "defect.pushed",
      title: "Defect pushed",
      body: `${outcome.defectKey} was created or linked for ${result.instance.titleSnapshot}.`,
      payload: {
        resultId: params.resultId.toString(),
        defectKey: outcome.defectKey,
        defectLinkId: upserted.id.toString(),
        provider,
        pushTitle: title,
        customFields,
        runId: result.instance.run.id.toString(),
        testId: result.instance.id.toString(),
        caseId: result.instance.caseId.toString(),
        assignedToUserId: result.instance.assignedTo?.toString() ?? null
      },
      notificationType: "activity"
    });
    return reply.send(
      toJsonSafe({
        data: {
          id: upserted.id,
          provider,
          defectKey: upserted.defectKey,
          url: upserted.url ?? null,
          remoteStatus: upserted.remoteStatus ?? null,
          remoteStatusLabel: upserted.remoteStatusLabel ?? null,
          remoteStatusSyncedAt: upserted.remoteStatusSyncedAt ?? null,
          title,
          description,
          customFields
        }
      })
    );
  });

  app.post("/api/results/:resultId/defects/:defectLinkId/sync", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "results.write" });
    const params = defectLinkIdParamSchema.parse(req.params);

    if (!deps.prisma) {
      const context = await deps.resultsService.findResultPushContext(params.resultId);
      if (!context) {
        throw new AppError("NOT_FOUND", "result not found", 404);
      }
      const link = findInMemoryResultDefectLink(params.resultId, params.defectLinkId);
      if (!link) {
        throw new AppError("NOT_FOUND", "defect link not found", 404);
      }
      const setting = await loadDefectIntegration(context.projectId, undefined);
      const snapshot = await syncProviderIssueStatus(toDefectApiConfig(setting), {
        defectKey: link.defectKey,
        providerIssueId: link.providerIssueId
      });
      const updated = updateInMemoryResultDefectLinkStatus(params.resultId, params.defectLinkId, {
        remoteStatus: snapshot.remoteStatus,
        remoteStatusLabel: snapshot.remoteStatusLabel,
        remoteStatusSyncedAt: snapshot.syncedAt
      });
      if (!updated) {
        throw new AppError("NOT_FOUND", "defect link not found", 404);
      }
      return reply.send(toJsonSafe({ data: toDefectLinkResponse(updated) }));
    }

    const link = await deps.prisma.resultDefectLink.findFirst({
      where: { id: params.defectLinkId, resultId: params.resultId, deletedAt: null },
      include: {
        result: {
          select: {
            instance: { select: { run: { select: { projectId: true } } } }
          }
        }
      }
    });
    if (!link) {
      throw new AppError("NOT_FOUND", "defect link not found", 404);
    }
    const setting = await loadDefectIntegration(link.result.instance.run.projectId, deps.prisma);
    const snapshot = await syncProviderIssueStatus(toDefectApiConfig(setting), {
      defectKey: link.defectKey,
      providerIssueId: link.providerIssueId
    });
    const updated = await deps.prisma.resultDefectLink.update({
      where: { id: params.defectLinkId },
      data: {
        remoteStatus: snapshot.remoteStatus,
        remoteStatusLabel: snapshot.remoteStatusLabel,
        remoteStatusSyncedAt: snapshot.syncedAt
      }
    });
    return reply.send(toJsonSafe({ data: toDefectLinkResponse(updated) }));
  });
}

