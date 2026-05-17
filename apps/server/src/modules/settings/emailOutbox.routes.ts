import { z } from "zod";

import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import { buildDigestBodyForTest } from "../notifications/notificationEmail.helpers.js";
import { type SettingsRouteDeps } from "./settings.shared.js";

const emailOutboxQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  status: z.enum(["pending", "sent", "failed"]).optional(),
  kind: z.enum(["immediate", "digest"]).optional(),
  recipientEmail: z.string().trim().min(1).optional()
});

const emailOutboxIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  outboxId: z.coerce.bigint()
});

const digestPreviewQuerySchema = z.object({
  userId: z.coerce.bigint().optional()
});

function outboxToResponse(row: {
  id: bigint;
  userId: bigint;
  recipientEmail: string;
  kind: string;
  subject: string;
  bodyText: string;
  status: string;
  attemptNo: number;
  nextRetryAt: Date | null;
  sentAt: Date | null;
  error: string | null;
  notificationIds: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const notificationIds = Array.isArray(row.notificationIds)
    ? row.notificationIds.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: row.id,
    userId: row.userId,
    recipientEmail: row.recipientEmail,
    kind: row.kind,
    subject: row.subject,
    bodyPreview: row.bodyText.length > 240 ? `${row.bodyText.slice(0, 240)}…` : row.bodyText,
    status: row.status,
    attemptNo: row.attemptNo,
    nextRetryAt: row.nextRetryAt,
    sentAt: row.sentAt,
    error: row.error,
    notificationIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export async function registerEmailOutboxRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings/email-outbox", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = emailOutboxQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) {
      return reply.send(
        toJsonSafe(
          ok({
            items: [],
            page: query.page,
            pageSize: query.pageSize,
            total: 0,
            totalPages: 1
          })
        )
      );
    }

    const where: Prisma.EmailOutboxWhereInput = {
      projectId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.recipientEmail
        ? { recipientEmail: { contains: query.recipientEmail, mode: "insensitive" } }
        : {})
    };

    const [total, rows] = await Promise.all([
      deps.prisma.emailOutbox.count({ where }),
      deps.prisma.emailOutbox.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      })
    ]);

    return reply.send(
      toJsonSafe(
        ok({
          items: rows.map(outboxToResponse),
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize))
        })
      )
    );
  });

  app.post("/api/projects/:projectId/settings/email-outbox/:outboxId/retry", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, outboxId } = emailOutboxIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_AVAILABLE", message: "email outbox requires database mode" });
    }

    const existing = await deps.prisma.emailOutbox.findFirst({
      where: { id: outboxId, projectId }
    });
    if (!existing) return reply.code(404).send({ code: "NOT_FOUND", message: "outbox row not found" });
    if (existing.status === "sent") {
      return reply.code(400).send({ code: "ALREADY_SENT", message: "email already sent" });
    }

    const updated = await deps.prisma.emailOutbox.update({
      where: { id: existing.id },
      data: {
        status: "pending",
        attemptNo: 1,
        error: null,
        nextRetryAt: null,
        sentAt: null,
        updatedAt: new Date()
      }
    });
    return reply.send(toJsonSafe(ok(outboxToResponse(updated))));
  });

  app.get("/api/projects/:projectId/settings/email-outbox/digest-preview", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = digestPreviewQuerySchema.parse(req.query ?? {});
    const targetUserId = query.userId ?? user.id;

    if (!deps.prisma) {
      return reply.send(ok({ bodyText: "", notificationCount: 0, recipientEmail: null }));
    }

    const preference = await deps.prisma.notificationPreference.findUnique({
      where: {
        userId_projectId: { userId: targetUserId, projectId }
      },
      select: {
        digestEnabled: true,
        lastDigestSentAt: true,
        assignmentEnabled: true,
        failedResultEnabled: true,
        activityEnabled: true,
        mentionEnabled: true,
        user: { select: { email: true, deletedAt: true } },
        project: { select: { name: true, deletedAt: true } }
      }
    });

    if (!preference || preference.user.deletedAt || preference.project.deletedAt) {
      return reply.send(ok({ bodyText: "", notificationCount: 0, recipientEmail: preference?.user.email ?? null }));
    }

    const since = preference.lastDigestSentAt ?? new Date(0);
    const notifications = await deps.prisma.notification.findMany({
      where: {
        userId: targetUserId,
        projectId,
        createdAt: { gt: since }
      },
      orderBy: { createdAt: "asc" },
      take: 50
    });

    const filtered = notifications.filter((row) => {
      if (row.type === "assignment") return preference.assignmentEnabled;
      if (row.type === "failed_result") return preference.failedResultEnabled;
      if (row.type === "activity") return preference.activityEnabled;
      if (row.type === "mention") return preference.mentionEnabled;
      return true;
    });

    const bodyText =
      filtered.length === 0
        ? ""
        : buildDigestBodyForTest(preference.project.name, filtered);

    return reply.send(
      ok({
        bodyText,
        notificationCount: filtered.length,
        recipientEmail: preference.user.email,
        digestEnabled: preference.digestEnabled
      })
    );
  });
}
