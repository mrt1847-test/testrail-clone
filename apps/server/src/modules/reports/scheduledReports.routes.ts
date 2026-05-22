import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import { recordReportScheduleRunRequestedActivity } from "../activity/activityRecording.js";
import { recordAuditLog } from "../settings/auditLog.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  createScheduledReportSchema,
  scheduledReportIdParamSchema,
  scheduledReportTypeSchema,
  updateScheduledReportSchema
} from "./scheduledReports.schema.js";
import {
  executeScheduledReport,
  initialNextRunAt,
  mapScheduledReport,
  resolveScheduledReportExportInput
} from "./scheduledReports.service.js";

async function resolveReportTypeForCreate(
  prisma: PrismaClient,
  projectId: bigint,
  body: { savedReportId?: bigint; reportType?: string }
) {
  if (body.savedReportId) {
    const saved = await prisma.savedReport.findFirst({
      where: { id: body.savedReportId, projectId, deletedAt: null }
    });
    if (!saved) throw new AppError("NOT_FOUND", "saved report not found", 404);
    return saved.reportType;
  }
  return scheduledReportTypeSchema.parse(body.reportType);
}

export async function registerScheduledReportsRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  app.get("/api/projects/:projectId/scheduled-reports", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) {
      return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    }
    const where = { projectId, deletedAt: null };
    const [rows, total] = await deps.prisma.$transaction([
      deps.prisma.scheduledReport.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      deps.prisma.scheduledReport.count({ where })
    ]);
    return reply.send(
      toJsonSafe({
        data: rows.map(mapScheduledReport),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      })
    );
  });

  app.post("/api/projects/:projectId/scheduled-reports", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = createScheduledReportSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "scheduled reports require prisma mode", 501);

    const reportType = await resolveReportTypeForCreate(deps.prisma, projectId, body);
    const nextRunAt = initialNextRunAt(body.intervalMinutes);

    const created = await deps.prisma.scheduledReport.create({
      data: {
        projectId,
        name: body.name,
        savedReportId: body.savedReportId ?? null,
        reportType,
        filters: (body.filters ?? {}) as Prisma.InputJsonValue,
        intervalMinutes: body.intervalMinutes,
        recipientEmails: body.recipientEmails,
        enabled: body.enabled ?? true,
        nextRunAt,
        createdBy: user.id
      }
    });

    await recordAuditLog(deps.prisma, {
      projectId,
      actorUserId: user.id,
      action: "report.schedule.created",
      entityType: "report",
      entityId: created.id,
      changes: {
        scheduledReportId: created.id.toString(),
        savedReportId: created.savedReportId?.toString() ?? null,
        reportType: created.reportType,
        intervalMinutes: created.intervalMinutes,
        enabled: created.enabled
      }
    });
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "report",
      entityId: created.id,
      eventType: "report.schedule_created",
      title: "Report schedule created",
      body: created.name,
      payload: {
        scheduledReportId: created.id.toString(),
        intervalMinutes: created.intervalMinutes,
        reportType: created.reportType
      }
    });

    return reply.status(201).send(toJsonSafe(ok(mapScheduledReport(created))));
  });

  app.patch("/api/projects/:projectId/scheduled-reports/:scheduledReportId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { scheduledReportId } = scheduledReportIdParamSchema.parse(req.params);
    const body = updateScheduledReportSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "scheduled reports require prisma mode", 501);

    const existing = await deps.prisma.scheduledReport.findFirst({
      where: { id: scheduledReportId, projectId, deletedAt: null }
    });
    if (!existing) throw new AppError("NOT_FOUND", "scheduled report not found", 404);

    const updated = await deps.prisma.scheduledReport.update({
      where: { id: scheduledReportId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.intervalMinutes !== undefined ? { intervalMinutes: body.intervalMinutes } : {}),
        ...(body.recipientEmails !== undefined ? { recipientEmails: body.recipientEmails } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.intervalMinutes !== undefined && !existing.lastRunAt
          ? { nextRunAt: initialNextRunAt(body.intervalMinutes) }
          : {})
      }
    });

    await recordAuditLog(deps.prisma, {
      projectId,
      actorUserId: user.id,
      action: "report.schedule.updated",
      entityType: "report",
      entityId: updated.id,
      changes: {
        scheduledReportId: updated.id.toString(),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.intervalMinutes !== undefined ? { intervalMinutes: body.intervalMinutes } : {}),
        ...(body.recipientEmails !== undefined ? { recipientEmailsUpdated: true } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {})
      }
    });
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "report",
      entityId: updated.id,
      eventType: "report.schedule_updated",
      title: "Report schedule updated",
      body: updated.name,
      payload: { scheduledReportId: updated.id.toString(), enabled: updated.enabled }
    });

    return reply.send(toJsonSafe(ok(mapScheduledReport(updated))));
  });

  app.delete("/api/projects/:projectId/scheduled-reports/:scheduledReportId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { scheduledReportId } = scheduledReportIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "scheduled reports require prisma mode", 501);

    const existing = await deps.prisma.scheduledReport.findFirst({
      where: { id: scheduledReportId, projectId, deletedAt: null }
    });
    if (!existing) throw new AppError("NOT_FOUND", "scheduled report not found", 404);

    await deps.prisma.scheduledReport.update({
      where: { id: scheduledReportId },
      data: { deletedAt: new Date(), enabled: false }
    });

    await recordAuditLog(deps.prisma, {
      projectId,
      actorUserId: user.id,
      action: "report.schedule.deleted",
      entityType: "report",
      entityId: scheduledReportId,
      changes: {
        scheduledReportId: scheduledReportId.toString(),
        reportType: existing.reportType,
        name: existing.name
      }
    });
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "report",
      entityId: scheduledReportId,
      eventType: "report.schedule_deleted",
      title: "Report schedule deleted",
      body: existing.name,
      payload: { scheduledReportId: scheduledReportId.toString() }
    });

    return reply.status(204).send();
  });

  app.post("/api/projects/:projectId/scheduled-reports/:scheduledReportId/run", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { scheduledReportId } = scheduledReportIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "scheduled reports require prisma mode", 501);

    const existing = await deps.prisma.scheduledReport.findFirst({
      where: { id: scheduledReportId, projectId, deletedAt: null }
    });
    if (!existing) throw new AppError("NOT_FOUND", "scheduled report not found", 404);

    await resolveScheduledReportExportInput(deps.prisma, existing);
    await recordAuditLog(deps.prisma, {
      projectId,
      actorUserId: user.id,
      action: "report.schedule.run_requested",
      entityType: "report",
      entityId: scheduledReportId,
      changes: {
        scheduledReportId: scheduledReportId.toString(),
        reportType: existing.reportType,
        manual: true
      }
    });
    await recordReportScheduleRunRequestedActivity(deps.prisma, {
      projectId,
      actorUserId: user.id,
      scheduledReportId,
      reportType: existing.reportType,
      name: existing.name,
      manual: true
    });
    const result = await executeScheduledReport(deps.prisma, scheduledReportId, {
      actorUserId: user.id,
      manual: true
    });

    return reply.send(toJsonSafe(ok(result)));
  });
}
