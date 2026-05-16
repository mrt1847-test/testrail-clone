import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { getAuthenticatedUser } from "../../common/middlewares/authorization.js";
import { requireInstanceAdmin } from "../../common/middlewares/instanceAdmin.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { accessDefaultsPatchSchema } from "../../domain/accessDefaults.js";
import type { AuthService } from "../auth/auth.service.js";
import { getAccessDefaults, updateAccessDefaults } from "./accessDefaults.service.js";

export async function registerAdminAccessDefaultsRoutes(
  app: FastifyInstance,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/admin/access-defaults", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const defaults = await getAccessDefaults(deps.prisma);
    return reply.send(toJsonSafe(ok(defaults)));
  });

  app.patch("/api/admin/access-defaults", async (req, reply) => {
    const user = await requireInstanceAdmin(req, deps);
    const body = accessDefaultsPatchSchema.parse(req.body);
    const updated = await updateAccessDefaults(deps.prisma, {
      defaultProjectMemberRole: body.defaultProjectMemberRole,
      newProjectAccessMode: body.newProjectAccessMode,
      updatedBy: user.id
    });
    return reply.send(toJsonSafe(ok(updated)));
  });
}
