import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/appError.js";
import {
  getAuthenticatedUser,
  requireProjectPermission
} from "../../common/middlewares/authorization.js";
import type { ProjectPermission } from "../../domain/permissionMatrix.js";
import { hasProjectPermission } from "../../domain/permissionMatrix.js";
import { resolveProjectAccess } from "../permissions/projectAccess.service.js";
import type { AuthService } from "../auth/auth.service.js";

export function attachmentPermissionsForEntity(entityType: string): {
  read: ProjectPermission;
  write: ProjectPermission;
} {
  if (entityType === "case" || entityType === "case_step") {
    return { read: "cases.read", write: "cases.write" };
  }
  return { read: "runs.read", write: "results.write" };
}

export async function requireProjectPermissionForProject(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient },
  projectId: bigint,
  permission: ProjectPermission,
  options?: { skipArchivedCheck?: boolean }
) {
  const user = await getAuthenticatedUser(req, deps);
  if (!deps.prisma) return;

  const access = await resolveProjectAccess(deps.prisma, user.id, projectId);
  if (!access || !hasProjectPermission(access.permissions, permission)) {
    throw new AppError("FORBIDDEN", `missing permission: ${permission}`, 403);
  }

  const project = await deps.prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { isActive: true }
  });
  if (!project) {
    throw new AppError("NOT_FOUND", `project ${projectId.toString()} not found`, 404);
  }
  if (!options?.skipArchivedCheck && !project.isActive) {
    throw new AppError("PROJECT_ARCHIVED", "project is archived and read-only", 403);
  }
}

export async function requireAttachmentPermission(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient },
  attachmentId: bigint,
  mode: "read" | "write"
) {
  if (!deps.prisma) return;
  const row = await deps.prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null },
    select: { projectId: true, entityType: true }
  });
  if (!row) {
    throw new AppError("NOT_FOUND", "attachment not found", 404);
  }
  const permissions = attachmentPermissionsForEntity(row.entityType);
  await requireProjectPermissionForProject(
    req,
    deps,
    row.projectId,
    mode === "read" ? permissions.read : permissions.write
  );
}

export async function requireResultAttachmentPermission(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient },
  resultId: bigint,
  mode: "read" | "write"
) {
  if (!deps.prisma) return;
  const result = await deps.prisma.testResult.findUnique({
    where: { id: resultId },
    select: { instance: { select: { run: { select: { projectId: true } } } } }
  });
  if (!result) {
    throw new AppError("NOT_FOUND", "result not found", 404);
  }
  const permission = mode === "read" ? "runs.read" : "results.write";
  await requireProjectPermissionForProject(req, deps, result.instance.run.projectId, permission);
}

/** Uses route params (`attachmentId`, `caseId`, `resultId`, …) when present. */
export async function requireAttachmentRoutePermission(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient },
  mode: "read" | "write",
  fallback?: { attachmentId?: bigint; resultId?: bigint }
) {
  const params = (req.params ?? {}) as Record<string, unknown>;
  if (params.attachmentId !== undefined) {
    await requireAttachmentPermission(req, deps, BigInt(String(params.attachmentId)), mode);
    return;
  }
  if (params.resultId !== undefined) {
    await requireProjectPermission(
      req,
      deps,
      mode === "read" ? "runs.read" : "results.write"
    );
    return;
  }
  if (params.caseId !== undefined || params.stepId !== undefined) {
    await requireProjectPermission(
      req,
      deps,
      mode === "read" ? "cases.read" : "cases.write"
    );
    return;
  }
  if (fallback?.attachmentId) {
    await requireAttachmentPermission(req, deps, fallback.attachmentId, mode);
    return;
  }
  if (fallback?.resultId) {
    await requireResultAttachmentPermission(req, deps, fallback.resultId, mode);
    return;
  }
  throw new AppError("FORBIDDEN", "unable to resolve project for authorization", 403);
}
