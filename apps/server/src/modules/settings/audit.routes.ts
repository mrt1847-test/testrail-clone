import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";

import { getAuthenticatedUser } from "../../common/middlewares/authorization.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  auditLogsQuerySchema,
  type SettingsRouteDeps
} from "./settings.shared.js";

export async function registerAuditRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
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
}
