import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import type { ResultsService } from "./results.service.js";
import { resultIdParamSchema, resultSchema, testIdParamSchema } from "./results.schema.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { AppError } from "../../common/errors/appError.js";
import { getAuthenticatedUser, requireAuthenticated, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import type { AuthService } from "../auth/auth.service.js";
import { recordActivityEvent, recordResultActivity } from "../activity/activity.service.js";
import {
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
  provider: z.string().trim().optional()
});

export async function registerResultsRoutes(
  app: FastifyInstance,
  deps: { resultsService: ResultsService; prisma?: PrismaClient; authService: AuthService }
) {
  app.post("/api/attachments", async (req, reply) => {
    await requireAuthenticated(req, deps);
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
    const created = await deps.prisma.attachment.create({
      data: {
        projectId: result.instance.run.projectId,
        entityType: "result",
        entityId: body.resultId,
        resultId: body.resultId,
        fileName: body.fileName,
        contentType: body.contentType,
        storagePath: body.storagePath,
        fileSize: body.fileSize,
        createdBy: user.id
      }
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
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const params = testIdParamSchema.parse(req.params);
    const body = resultSchema.parse(req.body);
    const projectId = await projectIdForTestInstance(deps.prisma, params.testId);
    try {
      body.customValues = await validateResultCustomValues(deps.prisma, projectId, body.customValues);
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
    const results = await deps.resultsService.listResultsForTestInstance(params.testId);
    return reply.send(toJsonSafe(results));
  });

  app.get("/api/results/:resultId/steps", async (req, reply) => {
    const params = resultIdParamSchema.parse(req.params);
    const steps = await deps.resultsService.listResultStepsByResultId(params.resultId);
    return reply.send(toJsonSafe(steps));
  });

  app.get("/api/results/:resultId/attachments", async (req, reply) => {
    const params = resultIdParamSchema.parse(req.params);
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
    await requireProjectMutationRole(req, deps);
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
    const created = await deps.prisma.attachment.create({
      data: {
        projectId: result.instance.run.projectId,
        entityType: "result",
        entityId: params.resultId,
        resultId: params.resultId,
        fileName: body.fileName,
        contentType: body.contentType,
        storagePath: body.storagePath ?? `local://results/${params.resultId.toString()}/${body.fileName}`,
        fileSize: body.fileSize,
        createdBy: user.id
      }
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
    await requireProjectMutationRole(req, deps);
    const params = resultIdParamSchema.parse(req.params);
    const body = attachmentPresignBodySchema.parse(req.body ?? {});
    const now = Date.now();
    const storagePath = `results/${params.resultId.toString()}/${now}-${body.fileName}`;
    return reply.send(
      toJsonSafe({
        data: {
          storagePath,
          uploadUrl: `https://storage.local/upload/${encodeURIComponent(storagePath)}`,
          method: "PUT",
          headers: {
            "content-type": body.contentType ?? "application/octet-stream"
          },
          expiresAt: new Date(now + 10 * 60 * 1000)
        }
      })
    );
  });

  app.get("/api/attachments/:attachmentId", async (req, reply) => {
    const params = attachmentIdParamSchema.parse(req.params);
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
    await requireProjectMutationRole(req, deps);
    const params = attachmentIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.status(204).send();
    }
    const found = await deps.prisma.attachment.findFirst({
      where: { id: params.attachmentId, deletedAt: null },
      select: { id: true }
    });
    if (!found) {
      throw new AppError("NOT_FOUND", "attachment not found", 404);
    }
    await deps.prisma.attachment.update({
      where: { id: params.attachmentId },
      data: { deletedAt: new Date() }
    });
    return reply.status(204).send();
  });

  app.post("/api/attachments/:attachmentId/download-url", async (req, reply) => {
    const params = attachmentIdParamSchema.parse(req.params);
    const now = Date.now();
    if (!deps.prisma) {
      return reply.send(
        toJsonSafe({
          data: {
            attachmentId: params.attachmentId,
            downloadUrl: `https://storage.local/download/local-attachment-${params.attachmentId.toString()}`,
            expiresAt: new Date(now + 10 * 60 * 1000)
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
    return reply.send(
      toJsonSafe({
        data: {
          attachmentId: row.id,
          downloadUrl: `https://storage.local/download/${encodeURIComponent(row.storagePath)}`,
          expiresAt: new Date(now + 10 * 60 * 1000)
        }
      })
    );
  });

  app.get("/api/results/:resultId/defects", async (req, reply) => {
    const params = resultIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await deps.prisma.resultDefectLink.findMany({
      where: { resultId: params.resultId, deletedAt: null },
      orderBy: { id: "desc" }
    });
    return reply.send(
      toJsonSafe(
        rows.map((row: (typeof rows)[number]) => ({
          id: row.id,
          defectKey: row.defectKey,
          url: row.url ?? null,
          createdAt: row.createdAt
        }))
      )
    );
  });

  app.post("/api/results/:resultId/defects", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
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
      select: { instance: { select: { run: { select: { projectId: true } }, titleSnapshot: true } } }
    });
    if (context) {
      await recordActivityEvent(deps.prisma, {
        projectId: context.instance.run.projectId,
        actorUserId: user.id,
        entityType: "result",
        entityId: params.resultId,
        eventType: "defect.linked",
        title: "Defect linked",
        body: `${body.defectKey} linked to ${context.instance.titleSnapshot}.`,
        payload: { defectKey: body.defectKey, defectLinkId: upserted.id.toString() },
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
    await requireProjectMutationRole(req, deps);
    const params = defectLinkIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.status(204).send();
    }
    const found = await deps.prisma.resultDefectLink.findFirst({
      where: { id: params.defectLinkId, resultId: params.resultId, deletedAt: null },
      select: { id: true }
    });
    if (!found) {
      throw new AppError("NOT_FOUND", "defect link not found", 404);
    }
    await deps.prisma.resultDefectLink.update({
      where: { id: params.defectLinkId },
      data: { deletedAt: new Date() }
    });
    return reply.status(204).send();
  });

  app.post("/api/results/:resultId/defects/push", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const params = resultIdParamSchema.parse(req.params);
    const body = defectPushBodySchema.parse(req.body ?? {});
    if (!deps.prisma) {
      const generatedKey = body.defectKey ?? `DEF-${Date.now()}`;
      return reply.send(
        toJsonSafe({
          data: {
            defectKey: generatedKey,
            url: null
          }
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
    const setting = await deps.prisma.defectIntegrationSetting.findFirst({
      where: { projectId: result.instance.run.projectId, deletedAt: null }
    });
    const provider = body.provider?.trim() || setting?.provider || "custom";
    const generatedKey =
      body.defectKey?.trim() ||
      `${(setting?.defaultProjectKey ?? "DEF").toUpperCase()}-${Math.floor(Date.now() / 1000)}`;
    const url =
      setting?.issueUrlTemplate && setting.issueUrlTemplate.includes("{key}")
        ? setting.issueUrlTemplate.replaceAll("{key}", generatedKey)
        : null;
    const upserted = await deps.prisma.resultDefectLink.upsert({
      where: { resultId_defectKey: { resultId: params.resultId, defectKey: generatedKey } },
      create: {
        resultId: params.resultId,
        defectKey: generatedKey,
        url,
        createdBy: user.id
      },
      update: {
        deletedAt: null,
        url
      }
    });
    await recordActivityEvent(deps.prisma, {
      projectId: result.instance.run.projectId,
      actorUserId: user.id,
      entityType: "result",
      entityId: params.resultId,
      eventType: "defect.pushed",
      title: "Defect pushed",
      body: `${generatedKey} was created or linked for ${result.instance.titleSnapshot}.`,
      payload: { defectKey: generatedKey, defectLinkId: upserted.id.toString(), provider },
      notificationType: "activity"
    });
    return reply.send(
      toJsonSafe({
        data: {
          id: upserted.id,
          provider,
          defectKey: upserted.defectKey,
          url: upserted.url ?? null,
          title: body.title ?? null,
          description: body.description ?? null
        }
      })
    );
  });
}
