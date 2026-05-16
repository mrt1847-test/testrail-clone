import type { PrismaClient } from "@prisma/client";

import {
  canMutateProjectWithPermissions,
  normalizeProjectPermissions,
  permissionsForBuiltInRole,
  type GlobalRole,
  type ProjectPermission
} from "../../domain/permissionMatrix.js";
import type { ProjectRole } from "../../domain/roles.js";
import { projectRoles } from "../../domain/roles.js";

export type ResolvedProjectAccess = {
  userId: bigint;
  projectId: bigint;
  builtInRole: ProjectRole;
  customRoleId: bigint | null;
  customRoleName: string | null;
  globalRole: GlobalRole;
  permissions: ProjectPermission[];
};

function parseBuiltInRole(role: string): ProjectRole {
  return (projectRoles as readonly string[]).includes(role) ? (role as ProjectRole) : "viewer";
}

export async function resolveProjectAccess(
  prisma: PrismaClient,
  userId: bigint,
  projectId: bigint
): Promise<ResolvedProjectAccess | null> {
  const [user, member] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: { globalRole: true }
    }),
    prisma.projectMember.findFirst({
      where: { projectId, userId, deletedAt: null },
      select: {
        role: true,
        customRoleId: true,
        customRole: { select: { id: true, name: true, permissions: true, isActive: true } }
      }
    })
  ]);

  if (!user || !member) return null;

  const builtInRole = parseBuiltInRole(member.role);
  const globalRole = user.globalRole === "instance_admin" ? "instance_admin" : "user";

  let permissions: ProjectPermission[];
  let customRoleId: bigint | null = null;
  let customRoleName: string | null = null;

  if (member.customRoleId && member.customRole?.isActive) {
    permissions = normalizeProjectPermissions(member.customRole.permissions);
    customRoleId = member.customRole.id;
    customRoleName = member.customRole.name;
    if (permissions.length === 0) {
      permissions = permissionsForBuiltInRole(builtInRole);
    }
  } else {
    permissions = permissionsForBuiltInRole(builtInRole);
  }

  if (globalRole === "instance_admin") {
    permissions = [...new Set([...permissions, ...permissionsForBuiltInRole("owner")])];
  }

  return {
    userId,
    projectId,
    builtInRole,
    customRoleId,
    customRoleName,
    globalRole,
    permissions
  };
}

export function accessAllowsMutation(access: ResolvedProjectAccess): boolean {
  return canMutateProjectWithPermissions(access.permissions);
}
