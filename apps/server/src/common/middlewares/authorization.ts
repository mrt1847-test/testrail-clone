import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { AppError } from "../errors/appError.js";
import { hasProjectPermission, type ProjectPermission } from "../../domain/permissionMatrix.js";
import { resolveProjectAccess, accessAllowsMutation } from "../../modules/permissions/projectAccess.service.js";
import type { AuthService } from "../../modules/auth/auth.service.js";

function getBearerToken(value?: string): string | undefined {
  if (!value) return undefined;
  const [scheme, token] = value.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

export async function getAuthenticatedUser(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  const token = getBearerToken(req.headers.authorization);
  const user = await deps.authService.me(token);
  if (!user) {
    throw new AppError("UNAUTHORIZED", "auth required", 401);
  }
  return user;
}

async function resolveProjectId(req: FastifyRequest, prisma?: PrismaClient) {
  const params = (req.params ?? {}) as Record<string, unknown>;
  if (params.projectId !== undefined) return BigInt(String(params.projectId));
  if (!prisma) return null;

  if (params.suiteId !== undefined) {
    const suite = await prisma.testSuite.findUnique({
      where: { id: BigInt(String(params.suiteId)) },
      select: { projectId: true }
    });
    return suite?.projectId ?? null;
  }

  if (params.sectionId !== undefined) {
    const section = await prisma.section.findUnique({
      where: { id: BigInt(String(params.sectionId)) },
      select: { suite: { select: { projectId: true } } }
    });
    return section?.suite.projectId ?? null;
  }

  if (params.caseId !== undefined) {
    const testCase = await prisma.testCase.findUnique({
      where: { id: BigInt(String(params.caseId)) },
      select: { projectId: true }
    });
    return testCase?.projectId ?? null;
  }

  if (params.stepId !== undefined) {
    const step = await prisma.testCaseStep.findFirst({
      where: { id: BigInt(String(params.stepId)), deletedAt: null },
      select: { testCase: { select: { projectId: true } } }
    });
    return step?.testCase.projectId ?? null;
  }

  if (params.testId !== undefined) {
    const testInstance = await prisma.testInstance.findUnique({
      where: { id: BigInt(String(params.testId)) },
      select: { run: { select: { projectId: true } } }
    });
    return testInstance?.run.projectId ?? null;
  }

  if (params.runId !== undefined) {
    const run = await prisma.testRun.findUnique({
      where: { id: BigInt(String(params.runId)) },
      select: { projectId: true }
    });
    return run?.projectId ?? null;
  }

  if (params.resultId !== undefined) {
    const result = await prisma.testResult.findUnique({
      where: { id: BigInt(String(params.resultId)) },
      select: { instance: { select: { run: { select: { projectId: true } } } } }
    });
    return result?.instance.run.projectId ?? null;
  }

  if (params.requirementId !== undefined) {
    const requirement = await prisma.requirement.findUnique({
      where: { id: BigInt(String(params.requirementId)) },
      select: { projectId: true }
    });
    return requirement?.projectId ?? null;
  }

  if (params.groupId !== undefined) {
    const group = await prisma.configurationGroup.findUnique({
      where: { id: BigInt(String(params.groupId)) },
      select: { projectId: true }
    });
    return group?.projectId ?? null;
  }

  if (params.configurationId !== undefined) {
    const configuration = await prisma.configuration.findUnique({
      where: { id: BigInt(String(params.configurationId)) },
      select: { group: { select: { projectId: true } } }
    });
    return configuration?.group.projectId ?? null;
  }

  if (params.attachmentId !== undefined) {
    const attachment = await prisma.attachment.findUnique({
      where: { id: BigInt(String(params.attachmentId)) },
      select: { projectId: true }
    });
    return attachment?.projectId ?? null;
  }

  return null;
}

export async function requireProjectPermission(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient },
  permission: ProjectPermission,
  options?: { skipArchivedCheck?: boolean }
) {
  const user = await getAuthenticatedUser(req, deps);

  if (!deps.prisma) {
    return;
  }

  const projectId = await resolveProjectId(req, deps.prisma);
  if (!projectId) {
    throw new AppError("FORBIDDEN", "unable to resolve project for authorization", 403);
  }

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

export async function requireProjectMutationRole(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient },
  options?: { skipArchivedCheck?: boolean; permission?: ProjectPermission }
) {
  const user = await getAuthenticatedUser(req, deps);

  if (!deps.prisma) {
    return;
  }

  const projectId = await resolveProjectId(req, deps.prisma);
  if (!projectId) {
    throw new AppError("FORBIDDEN", "unable to resolve project for authorization", 403);
  }

  const access = await resolveProjectAccess(deps.prisma, user.id, projectId);
  const allowed = options?.permission
    ? access && hasProjectPermission(access.permissions, options.permission)
    : access && accessAllowsMutation(access);

  if (!allowed) {
    const detail = options?.permission ?? "project mutation";
    throw new AppError("FORBIDDEN", `insufficient permissions for ${detail}`, 403);
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

export async function requireAuthenticated(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  await getAuthenticatedUser(req, deps);
}
