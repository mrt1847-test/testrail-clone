import { createHmac } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import {
  buildWebhookDeliveryPolicyView,
  normalizeProjectWebhookDisableThreshold
} from "../../domain/webhookDeliveryPolicy.js";
import { buildWebhookEventCatalog } from "../../domain/webhookEventCatalog.js";
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
  webhookAttemptDetailToResponse,
  type SettingsRouteDeps
} from "./settings.shared.js";

const webhookAttemptsQuerySchema = z.object({
  webhookId: z.coerce.bigint().optional(),
  status: z.enum(["pending", "delivered", "failed"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50)
});

const webhookAttemptIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  attemptId: z.coerce.bigint()
});

const webhookDeliveryPolicyPatchSchema = z.object({
  disableAfterConsecutiveFailures: z.number().int().min(1).max(50).nullable().optional()
});

export async function registerWebhooksRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings/webhooks", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.webhookSubscription.findMany({
        where: {
          deletedAt: null,
          OR: [{ projectId, scope: "project" }, { scope: "global" }]
        },
        orderBy: [{ scope: "asc" }, { isActive: "desc" }, { id: "desc" }],
        take: 100,
        select: {
          id: true,
          scope: true,
          event: true,
          targetUrl: true,
          secret: true,
          isActive: true,
          consecutiveFailures: true,
          disabledAt: true,
          lastFailureAt: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return reply.send(toJsonSafe(paged(rows.map(webhookToResponse), 1, 100)));
    }
    return reply.send(
      toJsonSafe(
        paged(
          webhooks
            .filter((item) => item.projectId === projectId || item.scope === "global")
            .map(webhookToResponse),
          1,
          100
        )
      )
    );
  });

  app.get("/api/projects/:projectId/settings/webhook-events", async (req, reply) => {
    projectIdParamSchema.parse(req.params);
    return reply.send(ok({ events: [...webhookEvents] }));
  });

  app.get("/api/projects/:projectId/settings/webhook-event-catalog", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    return reply.send(ok({ catalog: buildWebhookEventCatalog(projectId.toString()) }));
  });

  app.get("/api/projects/:projectId/settings/webhook-delivery-policy", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const project = await deps.prisma.project.findUnique({
        where: { id: projectId },
        select: { webhookDisableFailureThreshold: true }
      });
      if (!project) return reply.code(404).send({ code: "NOT_FOUND", message: "project not found" });
      return reply.send(toJsonSafe(ok(buildWebhookDeliveryPolicyView(project.webhookDisableFailureThreshold))));
    }
    return reply.send(toJsonSafe(ok(buildWebhookDeliveryPolicyView(null))));
  });

  app.patch("/api/projects/:projectId/settings/webhook-delivery-policy", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = webhookDeliveryPolicyPatchSchema.parse(req.body ?? {});
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_AVAILABLE", message: "webhook policy requires database mode" });
    }
    if (body.disableAfterConsecutiveFailures === undefined) {
      return reply.code(400).send({ code: "BAD_REQUEST", message: "disableAfterConsecutiveFailures is required" });
    }
    let normalized: number | null;
    try {
      normalized = normalizeProjectWebhookDisableThreshold(body.disableAfterConsecutiveFailures);
    } catch (e) {
      const message = e instanceof Error ? e.message : "invalid threshold";
      return reply.code(400).send({ code: "BAD_REQUEST", message });
    }
    const actor = await getAuthenticatedUser(req, deps);
    const updated = await deps.prisma.project.update({
      where: { id: projectId },
      data: {
        webhookDisableFailureThreshold: normalized,
        updatedBy: actor.id
      },
      select: { webhookDisableFailureThreshold: true }
    });
    await deps.prisma.auditLog.create({
      data: {
        projectId,
        actorUserId: actor.id,
        action: "settings.webhook_policy.updated",
        entityType: "project",
        entityId: projectId.toString(),
        changes: { webhookDisableFailureThreshold: normalized }
      }
    });
    return reply.send(toJsonSafe(ok(buildWebhookDeliveryPolicyView(updated.webhookDisableFailureThreshold))));
  });

  app.get("/api/projects/:projectId/settings/webhook-attempts", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const filters = webhookAttemptsQuerySchema.parse(req.query ?? {});
    if (deps.prisma) {
      const where = {
        projectId,
        ...(filters.webhookId ? { webhookId: filters.webhookId } : {}),
        ...(filters.status ? { status: filters.status } : {})
      };
      const [rows, total] = await Promise.all([
        deps.prisma.webhookDeliveryAttempt.findMany({
          where,
          orderBy: { id: "desc" },
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
          select: {
            id: true,
            webhookId: true,
            activityEventId: true,
            event: true,
            targetUrl: true,
            status: true,
            attemptNo: true,
            responseStatus: true,
            responseBody: true,
            error: true,
            nextRetryAt: true,
            deliveredAt: true,
            signature: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        deps.prisma.webhookDeliveryAttempt.count({ where })
      ]);
      return reply.send(
        toJsonSafe({
          data: rows.map(webhookAttemptToResponse),
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / filters.pageSize))
        })
      );
    }
    const filtered = webhookAttempts.filter(
      (item) =>
        item.projectId === projectId &&
        (filters.webhookId == null || item.webhookId === filters.webhookId) &&
        (filters.status == null || item.status === filters.status)
    );
    return reply.send(toJsonSafe(paged(filtered.map(webhookAttemptToResponse), filters.page, filters.pageSize)));
  });

  app.get("/api/projects/:projectId/settings/webhook-attempts/:attemptId", async (req, reply) => {
    const { projectId, attemptId } = webhookAttemptIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const row = await deps.prisma.webhookDeliveryAttempt.findFirst({
        where: { id: attemptId, projectId },
        select: {
          id: true,
          webhookId: true,
          activityEventId: true,
          event: true,
          targetUrl: true,
          status: true,
          attemptNo: true,
          responseStatus: true,
          responseBody: true,
          error: true,
          nextRetryAt: true,
          deliveredAt: true,
          signature: true,
          payload: true,
          createdAt: true,
          updatedAt: true
        }
      });
      if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook attempt not found" });
      return reply.send(toJsonSafe(ok(webhookAttemptDetailToResponse(row))));
    }
    const row = webhookAttempts.find((item) => item.projectId === projectId && item.id === attemptId);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook attempt not found" });
    return reply.send(toJsonSafe(ok(webhookAttemptDetailToResponse({ ...row, updatedAt: row.createdAt }))));
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
            scope: body.scope,
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
              scope: row.scope,
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
      scope: body.scope,
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
        where: { id: webhookId, deletedAt: null, OR: [{ projectId }, { scope: "global" }] },
        select: { id: true }
      });
      if (!existing) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
      const reEnable = body.isActive === true;
      const updated = await deps.prisma.webhookSubscription.update({
        where: { id: existing.id },
        data: {
          ...(body.event !== undefined ? { event: body.event } : {}),
          ...(body.scope !== undefined ? { scope: body.scope } : {}),
          ...(body.targetUrl !== undefined ? { targetUrl: body.targetUrl } : {}),
          ...(body.secret !== undefined ? { secret: body.secret } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(reEnable
            ? { consecutiveFailures: 0, disabledAt: null, lastFailureAt: null }
            : {}),
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
        changes: { event: updated.event, targetUrl: updated.targetUrl, isActive: updated.isActive, scope: updated.scope }
        }
      });
      return reply.send(toJsonSafe(ok(webhookToResponse(updated))));
    }
    const row = webhooks.find((item) => (item.projectId === projectId || item.scope === "global") && item.id === webhookId);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
    Object.assign(row, {
      ...(body.event !== undefined ? { event: body.event } : {}),
      ...(body.scope !== undefined ? { scope: body.scope } : {}),
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
        where: { id: webhookId, deletedAt: null, OR: [{ projectId }, { scope: "global" }] },
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
    const index = webhooks.findIndex((item) => (item.projectId === projectId || item.scope === "global") && item.id === webhookId);
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

  app.post("/api/projects/:projectId/settings/webhooks/:webhookId/test-send", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, webhookId } = webhookIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_AVAILABLE", message: "test-send requires database mode" });
    }
    const row = await deps.prisma.webhookSubscription.findFirst({
      where: { id: webhookId, deletedAt: null, isActive: true, OR: [{ projectId }, { scope: "global" }] }
    });
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "webhook not found" });
    const payload = { event: "webhook.test", message: "ping", sentAt: new Date().toISOString() };
    const body = JSON.stringify(payload);
    const signature = `sha256=${createHmac("sha256", row.secret).update(body).digest("hex")}`;
    const created = await deps.prisma.webhookDeliveryAttempt.create({
      data: {
        projectId,
        webhookId: row.id,
        activityEventId: null,
        event: "webhook.test",
        targetUrl: row.targetUrl,
        payload: payload as Prisma.InputJsonValue,
        signature,
        status: "pending"
      }
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(row.targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": "webhook.test"
        },
        body,
        signal: controller.signal
      });
      const text = await res.text();
      const preview = text.length > 500 ? `${text.slice(0, 500)}…` : text;
      await deps.prisma.webhookDeliveryAttempt.update({
        where: { id: created.id },
        data: {
          status: res.ok ? "delivered" : "failed",
          responseStatus: res.status,
          responseBody: text.length > 4000 ? `${text.slice(0, 4000)}…` : text,
          deliveredAt: res.ok ? new Date() : null,
          error: res.ok ? null : `http ${String(res.status)}`,
          updatedAt: new Date()
        }
      });
      return reply.send(toJsonSafe(ok({ ok: res.ok, status: res.status, bodyPreview: preview, attemptId: created.id.toString() })));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "request failed";
      await deps.prisma.webhookDeliveryAttempt.update({
        where: { id: created.id },
        data: { status: "failed", error: msg, updatedAt: new Date() }
      });
      return reply.send(toJsonSafe(ok({ ok: false, error: msg, attemptId: created.id.toString() })));
    } finally {
      clearTimeout(timeout);
    }
  });
}
