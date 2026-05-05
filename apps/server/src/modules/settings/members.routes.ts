import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import {
  addMemberSchema,
  updateMemberRoleSchema,
  memberIdParamSchema,
  enforceNotLastOwner,
  type SettingsRouteDeps
} from "./settings.shared.js";
import { recordActivityEvent } from "../activity/activity.service.js";

export async function registerMembersRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
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
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: actor.id,
      entityType: "project_member",
      entityId: result.id,
      eventType: "project.member.upsert",
      title: "Project member added or updated",
      body: result.email,
      payload: { userId: result.userId.toString(), role: result.role, email: result.email }
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
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: actor.id,
        entityType: "project_member",
        entityId: updated.id,
        eventType: "project.member.role.updated",
        title: "Project member role updated",
        body: updated.user.email,
        payload: { userId: updated.user.id.toString(), role: updated.role, email: updated.user.email }
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
      const removed = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const checked = await enforceNotLastOwner(tx, { projectId, memberId, deleting: true });
        if (!checked.exists) {
          throw new Error("MEMBER_NOT_FOUND");
        }
        const row = await tx.projectMember.update({
          where: { id: memberId },
          data: { deletedAt: new Date(), updatedBy: actor.id },
          select: { id: true, userId: true, user: { select: { email: true } } }
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
        return row;
      });
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: actor.id,
        entityType: "project_member",
        entityId: removed.id,
        eventType: "project.member.removed",
        title: "Project member removed",
        body: removed.user.email,
        payload: { userId: removed.userId.toString(), email: removed.user.email }
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
