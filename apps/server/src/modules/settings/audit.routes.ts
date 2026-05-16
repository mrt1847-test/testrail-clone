import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  auditLogsQuerySchema,
  type SettingsRouteDeps
} from "./settings.shared.js";

const auditRetentionPruneSchema = z.object({
  olderThanDays: z.coerce.number().int().min(30).max(3650)
});

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function auditWhere(projectId: bigint, query: ReturnType<typeof auditLogsQuerySchema.parse>): Prisma.AuditLogWhereInput {
  return {
    ...(query.scope === "all" ? {} : { projectId }),
    ...(query.action
      ? query.actionExact
        ? { action: { equals: query.action, mode: "insensitive" } }
        : { action: { contains: query.action, mode: "insensitive" } }
      : {}),
    ...(query.entityType
      ? query.entityTypeExact
        ? { entityType: { equals: query.entityType, mode: "insensitive" } }
        : { entityType: { contains: query.entityType, mode: "insensitive" } }
      : {}),
    ...(query.entityId ? { entityId: { contains: query.entityId, mode: "insensitive" } } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(query.actorEmail
      ? { actorUser: { email: { equals: query.actorEmail, mode: "insensitive" } } }
      : {}),
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
      : {}),
    ...(query.changesContains
      ? {
          changes: {
            string_contains: query.changesContains
          }
        }
      : {})
  };
}

export async function registerAuditRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings/audit-logs", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = auditLogsQuerySchema.parse(req.query ?? {});
    if (query.scope === "all") {
      await requireProjectMutationRole(req, deps);
    }
    if (deps.prisma) {
      const where = auditWhere(projectId, query);
      const [total, rows] = await Promise.all([
        deps.prisma.auditLog.count({ where }),
        deps.prisma.auditLog.findMany({
          where,
          orderBy: { id: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { project: { select: { id: true, name: true } } }
        })
      ]);
      return reply.send(
        toJsonSafe({
          data: {
            items: rows.map((row: (typeof rows)[number]) => ({
              id: row.id,
              projectId: row.projectId,
              projectName: row.project?.name ?? null,
              action: row.action,
              actorUserId: row.actorUserId,
              entityType: row.entityType,
              entityId: row.entityId,
              changes: row.changes,
              createdAt: row.createdAt
            })),
            filters: [
              "actorUserId",
              "actorEmail",
              "entityType",
              "entityId",
              "action",
              "actionExact",
              "entityTypeExact",
              "changesContains",
              "createdFrom",
              "createdTo",
              "q",
              "scope"
            ],
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
      projectId: bigint | null;
      projectName: string | null;
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
          filters: [
            "actorUserId",
            "actorEmail",
            "entityType",
            "entityId",
            "action",
            "actionExact",
            "entityTypeExact",
            "changesContains",
            "createdFrom",
            "createdTo",
            "q",
            "scope"
          ],
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
          totalPages: 1
        }
      })
    );
  });

  app.get("/api/projects/:projectId/settings/audit-logs/export.csv", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = auditLogsQuerySchema.parse({ ...(req.query ?? {}), page: 1, pageSize: 100 });
    if (query.scope === "all") {
      await requireProjectMutationRole(req, deps);
    }
    if (!deps.prisma) {
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="${query.scope === "all" ? "all-projects" : `project-${projectId.toString()}`}-audit-logs.csv"`);
      return reply.send("id,project_id,project_name,action,actor_user_id,actor_email,entity_type,entity_id,changes,created_at\n");
    }
    const rows = await deps.prisma.auditLog.findMany({
      where: auditWhere(projectId, query),
      orderBy: { id: "desc" },
      take: 5000,
      include: { actorUser: { select: { email: true } }, project: { select: { name: true } } }
    });
    const lines = [
      ["id", "project_id", "project_name", "action", "actor_user_id", "actor_email", "entity_type", "entity_id", "changes", "created_at"].join(","),
      ...rows.map((row) =>
        [
          row.id.toString(),
          row.projectId?.toString() ?? "",
          row.project?.name ?? "",
          row.action,
          row.actorUserId?.toString() ?? "",
          row.actorUser?.email ?? "",
          row.entityType,
          row.entityId,
          row.changes,
          row.createdAt.toISOString()
        ]
          .map(csvCell)
          .join(",")
      )
    ];
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${query.scope === "all" ? "all-projects" : `project-${projectId.toString()}`}-audit-logs.csv"`);
    return reply.send(`${lines.join("\n")}\n`);
  });

  app.post("/api/projects/:projectId/settings/audit-logs/retention-prune", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = auditRetentionPruneSchema.parse(req.body ?? {});
    if (!deps.prisma) return reply.send(ok({ deleted: 0, cutoff: null }));

    const cutoff = new Date(Date.now() - body.olderThanDays * 24 * 60 * 60 * 1000);
    const deleted = await deps.prisma.auditLog.deleteMany({
      where: {
        projectId,
        createdAt: { lt: cutoff },
        NOT: { action: "audit.retention_pruned" }
      }
    });
    await deps.prisma.auditLog.create({
      data: {
        projectId,
        actorUserId: user.id,
        action: "audit.retention_pruned",
        entityType: "audit",
        entityId: projectId.toString(),
        changes: {
          olderThanDays: body.olderThanDays,
          cutoff: cutoff.toISOString(),
          deleted: deleted.count
        }
      }
    });
    return reply.send(ok({ deleted: deleted.count, cutoff: cutoff.toISOString() }));
  });

  app.get("/api/projects/:projectId/settings/audit-log-filters", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = auditLogsQuerySchema.pick({ scope: true }).parse(req.query ?? {});
    if (query.scope === "all") {
      await requireProjectMutationRole(req, deps);
    }
    if (!deps.prisma) {
      return reply.send(ok({ actions: [], entityTypes: [] }));
    }
    const where = query.scope === "all" ? {} : { projectId };
    const [actions, entityTypes] = await Promise.all([
      deps.prisma.auditLog.findMany({
        where,
        distinct: ["action"],
        select: { action: true },
        orderBy: { id: "desc" },
        take: 100
      }),
      deps.prisma.auditLog.findMany({
        where,
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
}
