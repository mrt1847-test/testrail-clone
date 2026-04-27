import type { FastifyInstance } from "fastify";
import type { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";

type CustomFieldRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  fieldType: "text" | "number" | "select";
};

type WebhookRow = {
  id: bigint;
  projectId: bigint;
  event: string;
  targetUrl: string;
  isActive: boolean;
};

const customFields: CustomFieldRow[] = [];
const webhooks: WebhookRow[] = [];

const memberRoleSchema = z.enum(["owner", "manager", "tester", "viewer"]);
const addMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: memberRoleSchema.default("viewer")
});
const updateMemberRoleSchema = z.object({
  role: memberRoleSchema
});
const memberIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  memberId: z.coerce.bigint()
});

async function enforceNotLastOwner(
  tx: Prisma.TransactionClient,
  input: { projectId: bigint; memberId: bigint; nextRole?: string; deleting?: boolean }
) {
  const existing = await tx.projectMember.findFirst({
    where: { id: input.memberId, projectId: input.projectId, deletedAt: null },
    select: { id: true, role: true }
  });
  if (!existing) return { exists: false as const };
  const demoteOrDeleteOwner =
    existing.role === "owner" && (input.deleting === true || (input.nextRole !== undefined && input.nextRole !== "owner"));
  if (!demoteOrDeleteOwner) return { exists: true as const, existing };
  const ownerCount = await tx.projectMember.count({
    where: { projectId: input.projectId, deletedAt: null, role: "owner" }
  });
  if (ownerCount <= 1) {
    throw new Error("LAST_OWNER_PROTECTED");
  }
  return { exists: true as const, existing };
}

export async function registerSettingsRoutes(
  app: FastifyInstance,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/projects/:projectId/settings", async (req, reply) => {
    projectIdParamSchema.parse(req.params);
    return reply.send(
      ok({
        retentionDays: 90,
        strictPermissions: true
      })
    );
  });

  app.get("/api/projects/:projectId/settings/custom-fields", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const logs = await deps.prisma.auditLog.findMany({
        where: { projectId, entityType: "custom_field" },
        orderBy: { id: "desc" },
        take: 100
      });
      const items = logs
        .map((row: (typeof logs)[number]) => row.changes as { name?: string; fieldType?: "text" | "number" | "select" } | null)
        .filter(
          (
            value: { name?: string; fieldType?: "text" | "number" | "select" } | null
          ): value is { name?: string; fieldType?: "text" | "number" | "select" } => Boolean(value?.name)
        )
        .map((value: { name?: string; fieldType?: "text" | "number" | "select" }, index: number) => ({
          id: BigInt(index + 1),
          name: value.name!,
          fieldType: value.fieldType ?? "text"
        }));
      return reply.send(toJsonSafe(paged(items, 1, 100)));
    }
    return reply.send(toJsonSafe(paged(customFields.filter((item) => item.projectId === projectId), 1, 100)));
  });

  app.post("/api/projects/:projectId/settings/custom-fields", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = req.body as { name?: string; fieldType?: "text" | "number" | "select" };
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      await deps.prisma.auditLog.create({
        data: {
          projectId,
          actorUserId: actor.id,
          action: "settings.custom_field.created",
          entityType: "custom_field",
          entityId: `${Date.now()}`,
          changes: {
            name: body.name?.trim() || "new_field",
            fieldType: body.fieldType ?? "text"
          }
        }
      });
      return reply.send(
        toJsonSafe({
          data: {
            id: BigInt(Date.now()),
            name: body.name?.trim() || "new_field",
            fieldType: body.fieldType ?? "text"
          }
        })
      );
    }
    const row: CustomFieldRow = {
      id: BigInt(Date.now()),
      projectId,
      name: body.name?.trim() || "new_field",
      fieldType: body.fieldType ?? "text"
    };
    customFields.unshift(row);
    return reply.send(toJsonSafe({ data: row }));
  });

  app.get("/api/projects/:projectId/settings/webhooks", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const logs = await deps.prisma.auditLog.findMany({
        where: { projectId, entityType: "webhook" },
        orderBy: { id: "desc" },
        take: 100
      });
      const items = logs
        .map((row: (typeof logs)[number]) => row.changes as { event?: string; targetUrl?: string; isActive?: boolean } | null)
        .filter(
          (
            value: { event?: string; targetUrl?: string; isActive?: boolean } | null
          ): value is { event?: string; targetUrl?: string; isActive?: boolean } => Boolean(value?.event)
        )
        .map((value: { event?: string; targetUrl?: string; isActive?: boolean }, index: number) => ({
          id: BigInt(index + 1),
          event: value.event!,
          targetUrl: value.targetUrl ?? "",
          isActive: value.isActive ?? true
        }));
      return reply.send(toJsonSafe(paged(items, 1, 100)));
    }
    return reply.send(toJsonSafe(paged(webhooks.filter((item) => item.projectId === projectId), 1, 100)));
  });

  app.post("/api/projects/:projectId/settings/webhooks", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = req.body as { event?: string; targetUrl?: string };
    if (deps.prisma) {
      const actor = await getAuthenticatedUser(req, deps);
      await deps.prisma.auditLog.create({
        data: {
          projectId,
          actorUserId: actor.id,
          action: "settings.webhook.created",
          entityType: "webhook",
          entityId: `${Date.now()}`,
          changes: {
            event: body.event?.trim() || "result.created",
            targetUrl: body.targetUrl?.trim() || "https://example.com/webhook",
            isActive: true
          }
        }
      });
      return reply.send(
        toJsonSafe({
          data: {
            id: BigInt(Date.now()),
            event: body.event?.trim() || "result.created",
            targetUrl: body.targetUrl?.trim() || "https://example.com/webhook",
            isActive: true
          }
        })
      );
    }
    const row: WebhookRow = {
      id: BigInt(Date.now()),
      projectId,
      event: body.event?.trim() || "result.created",
      targetUrl: body.targetUrl?.trim() || "https://example.com/webhook",
      isActive: true
    };
    webhooks.unshift(row);
    return reply.send(toJsonSafe({ data: row }));
  });

  app.get("/api/projects/:projectId/settings/audit-logs", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const rows = await deps.prisma.auditLog.findMany({
        where: { projectId },
        orderBy: { id: "desc" },
        take: 100
      });
      return reply.send(
        toJsonSafe(
          ok({
            items: rows.map((row: (typeof rows)[number]) => ({
              id: row.id,
              action: row.action,
              actorUserId: row.actorUserId,
              entityType: row.entityType,
              entityId: row.entityId,
              changes: row.changes,
              createdAt: row.createdAt
            })),
            filters: ["actor", "entity_type", "action", "from", "to"]
          })
        )
      );
    }
    return reply.send(
      ok({
        items: [],
        filters: ["actor", "entity_type", "action", "from", "to"]
      })
    );
  });

  app.get("/api/projects/:projectId/settings/members", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.send(toJsonSafe(paged([], 1, 100)));
    }
    const rows = await deps.prisma.projectMember.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, email: true, name: true } }
      }
    });
    return reply.send(
      toJsonSafe(
        paged(
          rows.map((row: (typeof rows)[number]) => ({
            id: row.id,
            userId: row.user.id,
            email: row.user.email,
            name: row.user.name,
            role: row.role
          })),
          1,
          100
        )
      )
    );
  });

  app.post("/api/projects/:projectId/settings/members", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "members API needs prisma mode" });
    }
    const body = addMemberSchema.parse(req.body);
    const actor = await getAuthenticatedUser(req, deps);
    const normalizedEmail = body.email.trim().toLowerCase();
    const result = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.upsert({
        where: { email: normalizedEmail },
        update: {},
        create: { email: normalizedEmail, name: body.name ?? normalizedEmail.split("@")[0] ?? "User" }
      });
      const member = await tx.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: user.id } },
        update: { role: body.role, deletedAt: null, updatedBy: actor.id },
        create: {
          projectId,
          userId: user.id,
          role: body.role,
          createdBy: actor.id,
          updatedBy: actor.id
        }
      });
      await tx.auditLog.create({
        data: {
          projectId,
          actorUserId: actor.id,
          action: "project.member.upsert",
          entityType: "project_member",
          entityId: member.id.toString(),
          changes: { role: member.role, email: user.email }
        }
      });
      return { id: member.id, userId: user.id, email: user.email, name: user.name, role: member.role };
    });
    return reply.send(toJsonSafe(ok(result)));
  });

  app.patch("/api/projects/:projectId/settings/members/:memberId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, memberId } = memberIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "members API needs prisma mode" });
    }
    const body = updateMemberRoleSchema.parse(req.body);
    const actor = await getAuthenticatedUser(req, deps);
    try {
      const updated = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const checked = await enforceNotLastOwner(tx, { projectId, memberId, nextRole: body.role });
        if (!checked.exists) {
          throw new Error("MEMBER_NOT_FOUND");
        }
        const row = await tx.projectMember.update({
          where: { id: memberId },
          data: { role: body.role, updatedBy: actor.id },
          select: { id: true, role: true, user: { select: { id: true, email: true, name: true } } }
        });
        await tx.auditLog.create({
          data: {
            projectId,
            actorUserId: actor.id,
            action: "project.member.role.updated",
            entityType: "project_member",
            entityId: row.id.toString(),
            changes: { role: body.role }
          }
        });
        return row;
      });
      return reply.send(
        toJsonSafe(
          ok({
            id: updated.id,
            userId: updated.user.id,
            email: updated.user.email,
            name: updated.user.name,
            role: updated.role
          })
        )
      );
    } catch (e) {
      if (e instanceof Error && e.message === "MEMBER_NOT_FOUND") {
        return reply.code(404).send({ code: "NOT_FOUND", message: "member not found" });
      }
      if (e instanceof Error && e.message === "LAST_OWNER_PROTECTED") {
        return reply.code(409).send({ code: "LAST_OWNER_PROTECTED", message: "at least one owner is required" });
      }
      throw e;
    }
  });

  app.delete("/api/projects/:projectId/settings/members/:memberId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId, memberId } = memberIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "members API needs prisma mode" });
    }
    const actor = await getAuthenticatedUser(req, deps);
    try {
      await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const checked = await enforceNotLastOwner(tx, { projectId, memberId, deleting: true });
        if (!checked.exists) {
          throw new Error("MEMBER_NOT_FOUND");
        }
        await tx.projectMember.update({
          where: { id: memberId },
          data: { deletedAt: new Date(), updatedBy: actor.id }
        });
        await tx.auditLog.create({
          data: {
            projectId,
            actorUserId: actor.id,
            action: "project.member.removed",
            entityType: "project_member",
            entityId: memberId.toString()
          }
        });
      });
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof Error && e.message === "MEMBER_NOT_FOUND") {
        return reply.code(404).send({ code: "NOT_FOUND", message: "member not found" });
      }
      if (e instanceof Error && e.message === "LAST_OWNER_PROTECTED") {
        return reply.code(409).send({ code: "LAST_OWNER_PROTECTED", message: "at least one owner is required" });
      }
      throw e;
    }
  });
}
