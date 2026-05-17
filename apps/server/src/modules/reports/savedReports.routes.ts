import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import { recordAuditLog } from "../settings/auditLog.service.js";

const reportTypeSchema = z.enum([
  "run_summary",
  "milestone_summary",
  "plan_summary",
  "results_explorer",
  "traceability",
  "coverage_gap",
  "defect_coverage",
  "defect_summary",
  "case_activity_summary",
  "cases_property_distribution",
  "status_tops",
  "results_case_comparison",
  "results_property_distribution",
  "refs_coverage",
  "refs_comparison",
  "refs_defect_summary",
  "project_summary",
  "users_workload_summary"
]);

const savedReportIdParamSchema = z.object({
  savedReportId: z.coerce.bigint()
});

const savedReportFiltersSchema = z.object({
  ui: z.record(z.string()).optional(),
  export: z.record(z.unknown()).optional()
});

const createSavedReportSchema = z.object({
  name: z.string().trim().min(1).max(120),
  reportType: reportTypeSchema,
  filters: savedReportFiltersSchema.optional()
});

const updateSavedReportSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  filters: savedReportFiltersSchema.optional()
});

function mapSavedReport(row: {
  id: bigint;
  projectId: bigint;
  name: string;
  reportType: string;
  filters: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: bigint | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    reportType: row.reportType,
    filters: row.filters,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy
  };
}

export async function registerSavedReportsRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  app.get("/api/projects/:projectId/saved-reports", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) {
      return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    }
    const where = { projectId, deletedAt: null };
    const [rows, total] = await deps.prisma.$transaction([
      deps.prisma.savedReport.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      deps.prisma.savedReport.count({ where })
    ]);
    return reply.send(
      toJsonSafe({
        data: rows.map(mapSavedReport),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      })
    );
  });

  app.post("/api/projects/:projectId/saved-reports", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = createSavedReportSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "saved reports require prisma mode", 501);

    const created = await deps.prisma.savedReport.create({
      data: {
        projectId,
        name: body.name,
        reportType: body.reportType,
        filters: (body.filters ?? {}) as Prisma.InputJsonValue,
        createdBy: user.id
      }
    });

    await recordAuditLog(deps.prisma, {
      projectId,
      actorUserId: user.id,
      action: "report.saved.created",
      entityType: "report",
      entityId: created.id,
      changes: {
        savedReportId: created.id.toString(),
        reportType: created.reportType,
        name: created.name
      }
    });
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "report",
      entityId: created.id,
      eventType: "report.saved",
      title: "Report definition saved",
      body: created.name,
      payload: {
        savedReportId: created.id.toString(),
        reportType: created.reportType,
        name: created.name
      }
    });

    return reply.status(201).send(toJsonSafe(ok(mapSavedReport(created))));
  });

  app.patch("/api/projects/:projectId/saved-reports/:savedReportId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { savedReportId } = savedReportIdParamSchema.parse(req.params);
    const body = updateSavedReportSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "saved reports require prisma mode", 501);

    const existing = await deps.prisma.savedReport.findFirst({
      where: { id: savedReportId, projectId, deletedAt: null }
    });
    if (!existing) throw new AppError("NOT_FOUND", `saved report ${savedReportId.toString()} not found`, 404);

    const updated = await deps.prisma.savedReport.update({
      where: { id: savedReportId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.filters !== undefined ? { filters: body.filters as Prisma.InputJsonValue } : {})
      }
    });

    await recordAuditLog(deps.prisma, {
      projectId,
      actorUserId: user.id,
      action: "report.saved.updated",
      entityType: "report",
      entityId: updated.id,
      changes: {
        savedReportId: updated.id.toString(),
        reportType: updated.reportType,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.filters !== undefined ? { filtersUpdated: true } : {})
      }
    });
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "report",
      entityId: updated.id,
      eventType: "report.saved_updated",
      title: "Saved report updated",
      body: updated.name,
      payload: {
        savedReportId: updated.id.toString(),
        reportType: updated.reportType
      }
    });

    return reply.send(toJsonSafe(ok(mapSavedReport(updated))));
  });

  app.delete("/api/projects/:projectId/saved-reports/:savedReportId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { savedReportId } = savedReportIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "saved reports require prisma mode", 501);

    const existing = await deps.prisma.savedReport.findFirst({
      where: { id: savedReportId, projectId, deletedAt: null }
    });
    if (!existing) throw new AppError("NOT_FOUND", `saved report ${savedReportId.toString()} not found`, 404);

    await deps.prisma.savedReport.update({
      where: { id: savedReportId },
      data: { deletedAt: new Date() }
    });

    await recordAuditLog(deps.prisma, {
      projectId,
      actorUserId: user.id,
      action: "report.saved.deleted",
      entityType: "report",
      entityId: savedReportId,
      changes: {
        savedReportId: savedReportId.toString(),
        reportType: existing.reportType,
        name: existing.name
      }
    });
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "report",
      entityId: savedReportId,
      eventType: "report.saved_deleted",
      title: "Saved report deleted",
      body: existing.name,
      payload: {
        savedReportId: savedReportId.toString(),
        reportType: existing.reportType
      }
    });

    return reply.status(204).send();
  });
}
