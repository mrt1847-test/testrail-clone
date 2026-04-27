import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { AppError } from "../errors/appError.js";
import { canMutateProject } from "../../domain/permissions.js";
import type { ProjectRole } from "../../domain/roles.js";
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

  return null;
}

export async function requireProjectMutationRole(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  await requireAuthenticated(req, deps);
  const token = getBearerToken(req.headers.authorization);
  const user = await deps.authService.me(token);
  if (!user) {
    throw new AppError("UNAUTHORIZED", "auth required", 401);
  }

  if (!deps.prisma) {
    return;
  }

  const projectId = await resolveProjectId(req, deps.prisma);
  if (!projectId) {
    throw new AppError("FORBIDDEN", "unable to resolve project for authorization", 403);
  }

  const member = await deps.prisma.projectMember.findFirst({
    where: { projectId, userId: user.id, deletedAt: null },
    select: { role: true }
  });
  const role = member?.role as ProjectRole | undefined;
  if (!role || !canMutateProject(role)) {
    throw new AppError("FORBIDDEN", "insufficient project role for mutation", 403);
  }
}

export async function requireAuthenticated(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  await getAuthenticatedUser(req, deps);
}
