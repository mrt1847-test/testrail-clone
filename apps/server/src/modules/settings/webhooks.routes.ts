import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  webhooks,
  webhookAttempts,
  webhookCreateSchema,
  webhookUpdateSchema,
  webhookIdParamSchema,
  webhookRetryParamSchema,
  webhookEvents,
  type WebhookRow,
  newWebhookSecret,
  webhookToResponse,
  webhookAttemptToResponse,
  type SettingsRouteDeps
} from "./settings.shared.js";

export async function registerWebhooksRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings/webhooks", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.webhookSubscription.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ isActive: "desc" }, { id: "desc" }],
        take: 100,
        select: {
          id: true,
          event: true,
          targetUrl: true,
          secret: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return reply.send(toJsonSafe(paged(rows.map(webhookToResponse), 1, 100)));
    }
    return reply.send(toJsonSafe(paged(webhooks.filter((item) => item.projectId === projectId).map(webhookToResponse), 1, 100)));
  });

  app.get("/api/projects/:projectId/settings/webhook-events", async (req, reply) => {
    projectIdParamSchema.parse(req.params);
    return reply.send(ok({ events: [...webhookEvents] }));
  });

  app.get("/api/projects/:projectId/settings/webhook-attempts", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.webhookDeliveryAttempt.findMany({
        where: { projectId },
        orderBy: { id: "desc" },
        take: 50,
        select: {
          id: true,
          webhookId: true,
          activityEventId: true,
          event: true,
          targetUrl: true,
          status: true,
          attemptNo: true,
          responseStatus: true,
          error: true,
          nextRetryAt: true,
          deliveredAt: true,
          signature: true,
          createdAt: true
        }
      });
      return reply.send(toJsonSafe(paged(rows.map(webhookAttemptToResponse), 1, 50)));
    }
    return reply.send(
      toJsonSafe(paged(webhookAttempts.filter((item) => item.projectId === projectId).map(webhookAttemptToResponse), 1, 50))
    );
  });

  app.post("/api/projects/:projectId/settings/webhooks", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = webhookCreateSchema.parse(req.body ?? {});
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      const created = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const row = await tx.webhookSubscription.create({
          data: {
            projectId,
            event: body.event,
            targetUrl: body.targetUrl,
            secret: body.secret ?? newWebhookSecret(),
            isActive: body.isActive,
            createdBy: actor.id,
            updatedBy: actor.id
          }
        });
        await tx.auditLog.create({
          data: {
            projectId,
            actorUserId: actor.id,
            action: "settings.webhook.created",
            entityType: "webhook",
            entityId: row.id.toString(),
            changes: {
              event: row.event,
              targetUrl: row.targetUrl,
              isActive: row.isActive
            }
          }
        });
        return row;
      });
      return reply.send(toJsonSafe(ok(webhookToResponse(created))));
    }
    const row: WebhookRow = {
      id: BigInt(Date.now()),
      projectId,
      event: body.event,
      targetUrl: body.targetUrl,
      secret: body.secret ?? newWebhookSecret(),
      isActive: body.isActive
    };
    webhooks.unshift(row);
    return reply.send(toJsonSafe(ok(webhookToResponse(row))));
  });

  app.patch("/api/projects/:projectId/settings/webhooks/:webhookId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, webhookId } = webhookIdParamSchema.parse(req.params);
    const body = webhookUpdateSchema.parse(req.body ?? {});
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      const existing = await deps.prisma.webhookSubscription.findFirst({
        where: { id: webhookId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!existing) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
      const updated = await deps.prisma.webhookSubscription.update({
        where: { id: existing.id },
        data: {
          ...(body.event !== undefined ? { event: body.event } : {}),
          ...(body.targetUrl !== undefined ? { targetUrl: body.targetUrl } : {}),
          ...(body.secret !== undefined ? { secret: body.secret } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          updatedBy: actor.id
        }
      });
      await deps.prisma.auditLog.create({
        data: {
          projectId,
          actorUserId: actor.id,
          action: "settings.webhook.updated",
          entityType: "webhook",
          entityId: updated.id.toString(),
          changes: { event: updated.event, targetUrl: updated.targetUrl, isActive: updated.isActive }
        }
      });
      return reply.send(toJsonSafe(ok(webhookToResponse(updated))));
    }
    const row = webhooks.find((item) => item.projectId === projectId && item.id === webhookId);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
    Object.assign(row, {
      ...(body.event !== undefined ? { event: body.event } : {}),
      ...(body.targetUrl !== undefined ? { targetUrl: body.targetUrl } : {}),
      ...(body.secret !== undefined ? { secret: body.secret } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
    });
    return reply.send(toJsonSafe(ok(webhookToResponse(row))));
  });

  app.delete("/api/projects/:projectId/settings/webhooks/:webhookId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, webhookId } = webhookIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      const existing = await deps.prisma.webhookSubscription.findFirst({
        where: { id: webhookId, projectId, deletedAt: null },
        select: { id: true }
      });
      if (!existing) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
      await deps.prisma.webhookSubscription.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), isActive: false, updatedBy: actor.id }
      });
      await deps.prisma.auditLog.create({
        data: {
          projectId,
          actorUserId: actor.id,
          action: "settings.webhook.deleted",
          entityType: "webhook",
          entityId: webhookId.toString()
        }
      });
      return reply.code(204).send();
    }
    const index = webhooks.findIndex((item) => item.projectId === projectId && item.id === webhookId);
    if (index === -1) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
    webhooks.splice(index, 1);
    return reply.code(204).send();
  });

  app.post("/api/projects/:projectId/settings/webhook-attempts/:attemptId/retry", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, attemptId } = webhookRetryParamSchema.parse(req.params);
    if (deps.prisma) {
      const existing = await deps.prisma.webhookDeliveryAttempt.findFirst({
        where: { id: attemptId, projectId },
        select: { id: true, webhookId: true, attemptNo: true }
      });
      if (!existing) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook attempt not found" });
      const updated = await deps.prisma.webhookDeliveryAttempt.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          attemptNo: { increment: 1 },
          error: null,
          responseStatus: null,
          responseBody: null,
          nextRetryAt: null
        }
      });
      return reply.send(toJsonSafe(ok(webhookAttemptToResponse(updated))));
    }
    const row = webhookAttempts.find((item) => item.projectId === projectId && item.id === attemptId);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook attempt not found" });
    row.status = "pending";
    row.attemptNo += 1;
    return reply.send(toJsonSafe(ok(webhookAttemptToResponse(row))));
  });
}
