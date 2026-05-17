import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getAuthenticatedUser, requireProjectMutationRole, requireProjectPermission } from "../../common/middlewares/authorization.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { attachmentRetentionPolicySummary } from "../../domain/attachmentRetentionPolicy.js";
import { pruneDeletedAttachments } from "../attachments/attachmentRetention.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { SettingsRouteDeps } from "./settings.shared.js";

const attachmentRetentionPruneSchema = z.object({
  olderThanDays: z.coerce.number().int().optional()
});

export async function registerAttachmentRetentionRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings/attachments/retention-policy", async (req, reply) => {
    await requireProjectPermission(req, deps, "settings.read");
    projectIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(attachmentRetentionPolicySummary())));
  });

  app.post("/api/projects/:projectId/settings/attachments/retention-prune", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = attachmentRetentionPruneSchema.parse(req.body ?? {});
    if (!deps.prisma) {
      return reply.send(ok({ deleted: 0, cutoff: null, tombstoneBackfilled: 0 }));
    }

    const result = await pruneDeletedAttachments(deps.prisma, {
      projectId,
      olderThanDays: body.olderThanDays,
      actorUserId: user.id
    });
    return reply.send(ok(result));
  });
}
