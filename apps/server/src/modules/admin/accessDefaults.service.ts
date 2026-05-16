import type { Prisma, PrismaClient } from "@prisma/client";

import {
  ACCESS_DEFAULTS_SCOPE_NOTE,
  defaultAccessDefaults,
  defaultAssignableRoles,
  newProjectAccessModes,
  type AccessDefaultsResponse,
  type DefaultAssignableRole,
  type NewProjectAccessMode
} from "../../domain/accessDefaults.js";

let inMemoryDefaults = { ...defaultAccessDefaults };

function toResponse(row: {
  defaultProjectMemberRole: string;
  newProjectAccessMode: string;
}): AccessDefaultsResponse {
  const defaultProjectMemberRole = defaultAssignableRoles.includes(row.defaultProjectMemberRole as DefaultAssignableRole)
    ? (row.defaultProjectMemberRole as DefaultAssignableRole)
    : defaultAccessDefaults.defaultProjectMemberRole;
  const newProjectAccessMode = newProjectAccessModes.includes(row.newProjectAccessMode as NewProjectAccessMode)
    ? (row.newProjectAccessMode as NewProjectAccessMode)
    : defaultAccessDefaults.newProjectAccessMode;
  return {
    defaultProjectMemberRole,
    newProjectAccessMode,
    scopeNote: ACCESS_DEFAULTS_SCOPE_NOTE
  };
}

export async function getAccessDefaults(prisma?: PrismaClient): Promise<AccessDefaultsResponse> {
  if (!prisma) {
    return toResponse(inMemoryDefaults);
  }
  const row = await prisma.instanceAccessDefaults.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      defaultProjectMemberRole: defaultAccessDefaults.defaultProjectMemberRole,
      newProjectAccessMode: defaultAccessDefaults.newProjectAccessMode
    }
  });
  return toResponse(row);
}

export async function updateAccessDefaults(
  prisma: PrismaClient | undefined,
  input: {
    defaultProjectMemberRole?: DefaultAssignableRole;
    newProjectAccessMode?: NewProjectAccessMode;
    updatedBy: bigint;
  }
): Promise<AccessDefaultsResponse> {
  if (!prisma) {
    inMemoryDefaults = {
      defaultProjectMemberRole: input.defaultProjectMemberRole ?? inMemoryDefaults.defaultProjectMemberRole,
      newProjectAccessMode: input.newProjectAccessMode ?? inMemoryDefaults.newProjectAccessMode
    };
    return toResponse(inMemoryDefaults);
  }
  const row = await prisma.instanceAccessDefaults.upsert({
    where: { id: 1 },
    update: {
      ...(input.defaultProjectMemberRole !== undefined
        ? { defaultProjectMemberRole: input.defaultProjectMemberRole }
        : {}),
      ...(input.newProjectAccessMode !== undefined ? { newProjectAccessMode: input.newProjectAccessMode } : {}),
      updatedBy: input.updatedBy
    },
    create: {
      id: 1,
      defaultProjectMemberRole:
        input.defaultProjectMemberRole ?? defaultAccessDefaults.defaultProjectMemberRole,
      newProjectAccessMode: input.newProjectAccessMode ?? defaultAccessDefaults.newProjectAccessMode,
      updatedBy: input.updatedBy
    }
  });
  return toResponse(row);
}

export async function grantActiveUsersToProject(
  tx: Prisma.TransactionClient,
  input: {
    projectId: bigint;
    creatorUserId: bigint;
    role: DefaultAssignableRole;
  }
) {
  const users = await tx.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true }
  });
  for (const user of users) {
    if (user.id === input.creatorUserId) continue;
    await tx.projectMember.upsert({
      where: { projectId_userId: { projectId: input.projectId, userId: user.id } },
      update: { deletedAt: null, role: input.role, updatedBy: input.creatorUserId },
      create: {
        projectId: input.projectId,
        userId: user.id,
        role: input.role,
        createdBy: input.creatorUserId,
        updatedBy: input.creatorUserId
      }
    });
  }
}

/** Reset in-memory store between tests. */
export function resetInMemoryAccessDefaultsForTests() {
  inMemoryDefaults = { ...defaultAccessDefaults };
}
