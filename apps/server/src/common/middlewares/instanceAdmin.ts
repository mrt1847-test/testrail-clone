import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { AppError } from "../errors/appError.js";
import type { AuthService } from "../../modules/auth/auth.service.js";
import { getAuthenticatedUser } from "./authorization.js";

/** Instance settings: any project owner, or any authenticated user when prisma is off (dev/tests). */
export async function requireInstanceAdmin(
  req: FastifyRequest,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  const user = await getAuthenticatedUser(req, deps);
  if (!deps.prisma) {
    return user;
  }
  const dbUser = await deps.prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
    select: { globalRole: true }
  });
  if (dbUser?.globalRole === "instance_admin") {
    return user;
  }

  const ownerMembership = await deps.prisma.projectMember.findFirst({
    where: { userId: user.id, deletedAt: null, role: "owner", project: { deletedAt: null } },
    select: { id: true }
  });
  if (!ownerMembership) {
    throw new AppError(
      "FORBIDDEN",
      "instance admin requires instance_admin global role or owner role on at least one project",
      403
    );
  }
  return user;
}
