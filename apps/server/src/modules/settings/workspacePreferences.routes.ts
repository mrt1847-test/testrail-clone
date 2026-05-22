import type { FastifyInstance } from "fastify";

import { AppError } from "../../common/errors/appError.js";
import { getAuthenticatedUser } from "../../common/middlewares/authorization.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { workspacePreferencesPatchSchema } from "../../domain/workspacePreferences.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { SettingsRouteDeps } from "./settings.shared.js";
import {
  getWorkspacePreferences,
  upsertWorkspacePreferences
} from "./workspacePreferences.service.js";

export async function registerWorkspacePreferencesRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/workspace-preferences", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const preferences = await getWorkspacePreferences(user.id, projectId, deps.prisma);
    return reply.send(toJsonSafe(ok(preferences)));
  });

  app.patch("/api/projects/:projectId/workspace-preferences", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = workspacePreferencesPatchSchema.parse(req.body ?? {});
    try {
      const preferences = await upsertWorkspacePreferences(
        user.id,
        projectId,
        {
          landingPage: body.landingPage,
          defaultSuiteId: body.defaultSuiteId,
          defaultSavedViewId: body.defaultSavedViewId
        },
        deps.prisma
      );
      return reply.send(toJsonSafe(ok(preferences)));
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_DEFAULT_SUITE") {
        throw new AppError("VALIDATION_ERROR", "Default suite not found in this project.", 400);
      }
      throw error;
    }
  });
}
