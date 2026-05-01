import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import { getAuthenticatedUser } from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";

const activityQuerySchema = z.object({
  entityType: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  eventType: z.string().trim().min(1).optional()
});

const notificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().default(false)
});

const notificationIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  notificationId: z.coerce.bigint()
});

const preferencesSchema = z.object({
  assignmentEnabled: z.boolean().optional(),
  failedResultEnabled: z.boolean().optional(),
  mentionEnabled: z.boolean().optional(),
  digestEnabled: z.boolean().optional()
});

const defaultPreferences = {
  assignmentEnabled: true,
  failedResultEnabled: true,
  mentionEnabled: true,
  digestEnabled: false
};

export async function registerActivityRoutes(
  app: FastifyInstance,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/projects/:projectId/activity", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const filters = activityQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) {
      return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    }

    const where = {
      projectId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.eventType ? { eventType: filters.eventType } : {})
    };
    const [items, total] = await Promise.all([
      deps.prisma.activityEvent.findMany({
        where,
        include: { actorUser: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      deps.prisma.activityEvent.count({ where })
    ]);

    return reply.send(
      toJsonSafe({
        data: items.map((item) => ({
          id: item.id,
          projectId: item.projectId,
          actorUserId: item.actorUserId,
          actor: item.actorUser
            ? { id: item.actorUser.id, email: item.actorUser.email, name: item.actorUser.name }
            : null,
          entityType: item.entityType,
          entityId: item.entityId,
          eventType: item.eventType,
          title: item.title,
          body: item.body,
          payload: item.payload,
          createdAt: item.createdAt
        })),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      })
    );
  });

  app.get("/api/projects/:projectId/notifications", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const { unreadOnly } = notificationsQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) {
      return reply.send(toJsonSafe({ data: [], unreadCount: 0, page, pageSize, total: 0, totalPages: 1 }));
    }

    const where = {
      projectId,
      userId: user.id,
      ...(unreadOnly ? { readAt: null } : {})
    };
    const [items, total, unreadCount] = await Promise.all([
      deps.prisma.notification.findMany({
        where,
        include: { activityEvent: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      deps.prisma.notification.count({ where }),
      deps.prisma.notification.count({ where: { projectId, userId: user.id, readAt: null } })
    ]);

    return reply.send(
      toJsonSafe({
        data: items.map((item) => ({
          id: item.id,
          projectId: item.projectId,
          activityEventId: item.activityEventId,
          type: item.type,
          title: item.title,
          body: item.body,
          readAt: item.readAt,
          createdAt: item.createdAt,
          activity: item.activityEvent
            ? {
                id: item.activityEvent.id,
                entityType: item.activityEvent.entityType,
                entityId: item.activityEvent.entityId,
                eventType: item.activityEvent.eventType
              }
            : null
        })),
        unreadCount,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      })
    );
  });

  app.patch("/api/projects/:projectId/notifications/:notificationId/read", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId, notificationId } = notificationIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe(ok({ id: notificationId, readAt: new Date() })));
    const updated = await deps.prisma.notification.updateMany({
      where: { id: notificationId, projectId, userId: user.id },
      data: { readAt: new Date() }
    });
    if (updated.count === 0) throw new AppError("NOT_FOUND", "notification not found", 404);
    return reply.send(toJsonSafe(ok({ id: notificationId, readAt: new Date() })));
  });

  app.post("/api/projects/:projectId/notifications/read-all", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe(ok({ updated: 0 })));
    const updated = await deps.prisma.notification.updateMany({
      where: { projectId, userId: user.id, readAt: null },
      data: { readAt: new Date() }
    });
    return reply.send(toJsonSafe(ok({ updated: updated.count })));
  });

  app.get("/api/projects/:projectId/notification-preferences", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe(ok({ ...defaultPreferences })));
    const preferences = await deps.prisma.notificationPreference.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } }
    });
    return reply.send(toJsonSafe(ok(preferences ?? { userId: user.id, projectId, ...defaultPreferences })));
  });

  app.patch("/api/projects/:projectId/notification-preferences", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = preferencesSchema.parse(req.body ?? {});
    if (!deps.prisma) return reply.send(toJsonSafe(ok({ ...defaultPreferences, ...body })));
    const preferences = await deps.prisma.notificationPreference.upsert({
      where: { userId_projectId: { userId: user.id, projectId } },
      create: { userId: user.id, projectId, ...defaultPreferences, ...body },
      update: body
    });
    return reply.send(toJsonSafe(ok(preferences)));
  });
}
