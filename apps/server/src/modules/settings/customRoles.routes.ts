import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { AppError } from "../../common/errors/appError.js";
import { PROJECT_PERMISSIONS, normalizeProjectPermissions } from "../../domain/permissionMatrix.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { SettingsRouteDeps } from "./settings.shared.js";
import { normalizeSystemName } from "../admin/users.routes.js";

const customRoleIdParamSchema = z.object({
  projectId: z.coerce.bigint(),
  roleId: z.coerce.bigint()
});

const customRoleCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  systemName: z.string().trim().min(1).optional(),
  permissions: z.array(z.enum(PROJECT_PERMISSIONS)).min(1),
  isActive: z.boolean().default(true)
});

const customRoleUpdateSchema = customRoleCreateSchema.partial();

type InMemoryCustomRole = {
  id: bigint;
  projectId: bigint;
  name: string;
  systemName: string;
  permissions: string[];
  isActive: boolean;
};

const inMemoryCustomRoles: InMemoryCustomRole[] = [];

function roleResponse(row: InMemoryCustomRole) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    systemName: row.systemName,
    permissions: normalizeProjectPermissions(row.permissions),
    isActive: row.isActive
  };
}

export async function registerCustomRolesRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings/custom-roles", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      const rows = inMemoryCustomRoles.filter((row) => row.projectId === projectId);
      return reply.send(toJsonSafe(paged(rows.map(roleResponse), 1, 100)));
    }
    const rows = await deps.prisma.customRole.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });
    return reply.send(
      toJsonSafe(
        paged(
          rows.map((row) => roleResponse({ ...row, permissions: row.permissions })),
          1,
          100
        )
      )
    );
  });

  app.post("/api/projects/:projectId/settings/custom-roles", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "members.manage" });
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = customRoleCreateSchema.parse(req.body ?? {});
    const systemName = normalizeSystemName(body.systemName ?? body.name);

    if (!deps.prisma) {
      const created: InMemoryCustomRole = {
        id: BigInt(Date.now()),
        projectId,
        name: body.name,
        systemName,
        permissions: body.permissions,
        isActive: body.isActive
      };
      inMemoryCustomRoles.unshift(created);
      return reply.send(toJsonSafe(ok(roleResponse(created))));
    }

    const existing = await deps.prisma.customRole.findFirst({
      where: { projectId, systemName, deletedAt: null }
    });
    if (existing) {
      throw new AppError("VALIDATION_ERROR", `custom role ${systemName} already exists`, 400);
    }

    const created = await deps.prisma.customRole.create({
      data: {
        projectId,
        name: body.name,
        systemName,
        permissions: body.permissions,
        isActive: body.isActive
      }
    });
    return reply.send(toJsonSafe(ok(roleResponse({ ...created, permissions: created.permissions }))));
  });

  app.patch("/api/projects/:projectId/settings/custom-roles/:roleId", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "members.manage" });
    const { projectId, roleId } = customRoleIdParamSchema.parse(req.params);
    const body = customRoleUpdateSchema.parse(req.body ?? {});

    if (!deps.prisma) {
      const row = inMemoryCustomRoles.find((item) => item.id === roleId && item.projectId === projectId);
      if (!row) throw new AppError("NOT_FOUND", "custom role not found", 404);
      if (body.name) row.name = body.name;
      if (body.permissions) row.permissions = body.permissions;
      if (body.isActive !== undefined) row.isActive = body.isActive;
      return reply.send(toJsonSafe(ok(roleResponse(row))));
    }

    const updated = await deps.prisma.customRole.update({
      where: { id: roleId },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.permissions ? { permissions: body.permissions } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {})
      }
    });
    if (updated.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "custom role not found", 404);
    }
    return reply.send(toJsonSafe(ok(roleResponse({ ...updated, permissions: updated.permissions }))));
  });

  app.delete("/api/projects/:projectId/settings/custom-roles/:roleId", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "members.manage" });
    const { projectId, roleId } = customRoleIdParamSchema.parse(req.params);

    if (!deps.prisma) {
      const index = inMemoryCustomRoles.findIndex((item) => item.id === roleId && item.projectId === projectId);
      if (index < 0) throw new AppError("NOT_FOUND", "custom role not found", 404);
      inMemoryCustomRoles.splice(index, 1);
      return reply.status(204).send();
    }

    await deps.prisma.$transaction(async (tx) => {
      await tx.projectMember.updateMany({
        where: { projectId, customRoleId: roleId },
        data: { customRoleId: null }
      });
      await tx.customRole.update({
        where: { id: roleId },
        data: { deletedAt: new Date(), isActive: false }
      });
    });
    return reply.status(204).send();
  });
}
