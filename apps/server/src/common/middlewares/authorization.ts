import type { FastifyRequest } from "fastify";

import { AppError } from "../errors/appError.js";
import { canMutateProject } from "../../domain/permissions.js";
import type { ProjectRole } from "../../domain/roles.js";

export function requireProjectMutationRole(req: FastifyRequest) {
  const role = (req.headers["x-project-role"] as string | undefined) as ProjectRole | undefined;
  if (!role || !canMutateProject(role)) {
    throw new AppError("FORBIDDEN", "insufficient project role for mutation", 403);
  }
}
