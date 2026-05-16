import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { requireInstanceAdmin } from "../../common/middlewares/instanceAdmin.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { AppError } from "../../common/errors/appError.js";
import { GLOBAL_ROLES, isGlobalRole } from "../../domain/permissionMatrix.js";
import { buildPermissionMatrixCatalog } from "../../domain/permissionMatrix.js";
import type { AuthService } from "../auth/auth.service.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";

const userIdParamSchema = z.object({ userId: z.coerce.bigint() });
const groupIdParamSchema = z.object({ groupId: z.coerce.bigint() });

const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  globalRole: z.enum(GLOBAL_ROLES).optional(),
  isActive: z.boolean().optional()
});

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional()
});

const updateGroupSchema = createGroupSchema.partial();

const groupMemberSchema = z.object({
  userId: z.coerce.bigint()
});

type InMemoryUser = {
  id: bigint;
  email: string;
  name: string;
  globalRole: string;
  isActive: boolean;
};

type InMemoryGroup = {
  id: bigint;
  name: string;
  description: string | null;
  memberUserIds: bigint[];
};

const inMemoryUsers: InMemoryUser[] = [];
const inMemoryGroups: InMemoryGroup[] = [];

function normalizeSystemName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export async function registerAdminUsersRoutes(
  app: FastifyInstance,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/admin/permission-matrix", async (req, reply) => {
    await requireInstanceAdmin(req, deps);
    return reply.send(toJsonSafe(ok(buildPermissionMatrixCatalog())));
  });

  app.get("/api/admin/users", async (req, reply) => {
    await requireInstanceAdmin(req, deps);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) {
      return reply.send(toJsonSafe(paged(inMemoryUsers, page, pageSize)));
    }
    const [rows, total] = await Promise.all([
      deps.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { id: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          globalRole: true,
          isActive: true,
          groupMembers: { select: { group: { select: { id: true, name: true } } } }
        }
      }),
      deps.prisma.user.count({ where: { deletedAt: null } })
    ]);
    return reply.send(
      toJsonSafe({
        data: rows.map((row) => ({
          id: row.id,
          email: row.email,
          name: row.name,
          globalRole: isGlobalRole(row.globalRole) ? row.globalRole : "user",
          isActive: row.isActive,
          groups: row.groupMembers.map((member) => ({ id: member.group.id, name: member.group.name }))
        })),
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      })
    );
  });

  app.patch("/api/admin/users/:userId", async (req, reply) => {
    const actor = await requireInstanceAdmin(req, deps);
    const { userId } = userIdParamSchema.parse(req.params);
    const body = updateUserSchema.parse(req.body ?? {});

    if (!deps.prisma) {
      const row = inMemoryUsers.find((item) => item.id === userId);
      if (!row) throw new AppError("NOT_FOUND", "user not found", 404);
      if (body.name) row.name = body.name;
      if (body.globalRole) row.globalRole = body.globalRole;
      if (body.isActive !== undefined) row.isActive = body.isActive;
      return reply.send(toJsonSafe(ok(row)));
    }

    const updated = await deps.prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.globalRole ? { globalRole: body.globalRole } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      },
      select: { id: true, email: true, name: true, globalRole: true, isActive: true }
    });
    void actor;
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.get("/api/admin/groups", async (req, reply) => {
    await requireInstanceAdmin(req, deps);
    if (!deps.prisma) {
      return reply.send(toJsonSafe(ok(inMemoryGroups)));
    }
    const rows = await deps.prisma.userGroup.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } }
        }
      }
    });
    return reply.send(
      toJsonSafe(
        ok(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            members: row.members.map((member) => ({
              userId: member.user.id,
              email: member.user.email,
              name: member.user.name
            }))
          }))
        )
      )
    );
  });

  app.post("/api/admin/groups", async (req, reply) => {
    const actor = await requireInstanceAdmin(req, deps);
    const body = createGroupSchema.parse(req.body ?? {});
    if (!deps.prisma) {
      const row: InMemoryGroup = {
        id: BigInt(Date.now()),
        name: body.name,
        description: body.description ?? null,
        memberUserIds: []
      };
      inMemoryGroups.unshift(row);
      return reply.send(toJsonSafe(ok(row)));
    }
    const created = await deps.prisma.userGroup.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        createdBy: actor.id
      }
    });
    return reply.send(toJsonSafe(ok(created)));
  });

  app.patch("/api/admin/groups/:groupId", async (req, reply) => {
    await requireInstanceAdmin(req, deps);
    const { groupId } = groupIdParamSchema.parse(req.params);
    const body = updateGroupSchema.parse(req.body ?? {});
    if (!deps.prisma) {
      const row = inMemoryGroups.find((item) => item.id === groupId);
      if (!row) throw new AppError("NOT_FOUND", "group not found", 404);
      if (body.name) row.name = body.name;
      if (body.description !== undefined) row.description = body.description;
      return reply.send(toJsonSafe(ok(row)));
    }
    const updated = await deps.prisma.userGroup.update({
      where: { id: groupId },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {})
      }
    });
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.post("/api/admin/groups/:groupId/members", async (req, reply) => {
    await requireInstanceAdmin(req, deps);
    const { groupId } = groupIdParamSchema.parse(req.params);
    const body = groupMemberSchema.parse(req.body ?? {});
    if (!deps.prisma) {
      const row = inMemoryGroups.find((item) => item.id === groupId);
      if (!row) throw new AppError("NOT_FOUND", "group not found", 404);
      if (!row.memberUserIds.includes(body.userId)) row.memberUserIds.push(body.userId);
      return reply.status(204).send();
    }
    await deps.prisma.userGroupMember.upsert({
      where: { groupId_userId: { groupId, userId: body.userId } },
      update: {},
      create: { groupId, userId: body.userId }
    });
    return reply.status(204).send();
  });

  app.delete("/api/admin/groups/:groupId/members/:userId", async (req, reply) => {
    await requireInstanceAdmin(req, deps);
    const { groupId } = groupIdParamSchema.parse(req.params);
    const userId = userIdParamSchema.parse(req.params).userId;
    if (!deps.prisma) {
      const row = inMemoryGroups.find((item) => item.id === groupId);
      if (!row) throw new AppError("NOT_FOUND", "group not found", 404);
      row.memberUserIds = row.memberUserIds.filter((id) => id !== userId);
      return reply.status(204).send();
    }
    await deps.prisma.userGroupMember.deleteMany({ where: { groupId, userId } });
    return reply.status(204).send();
  });
}

export { normalizeSystemName };
