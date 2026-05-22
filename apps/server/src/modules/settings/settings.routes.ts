import type { FastifyInstance } from "fastify";

import { ok } from "../../common/utils/http.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import { type SettingsRouteDeps } from "./settings.shared.js";
import { registerCustomFieldsRoutes } from "./customFields.routes.js";
import { registerStatusesRoutes } from "./statuses.routes.js";
import { registerTemplatesRoutes } from "./templates.routes.js";
import { registerWebhooksRoutes } from "./webhooks.routes.js";
import { registerAttachmentRetentionRoutes } from "./attachmentRetention.routes.js";
import { registerAuditRoutes } from "./audit.routes.js";
import { registerEmailOutboxRoutes } from "./emailOutbox.routes.js";
import { registerMembersRoutes } from "./members.routes.js";
import { registerCustomRolesRoutes } from "./customRoles.routes.js";
import { registerWorkspacePreferencesRoutes } from "./workspacePreferences.routes.js";

export async function registerSettingsRoutes(app: FastifyInstance, deps: SettingsRouteDeps) {
  app.get("/api/projects/:projectId/settings", async (req, reply) => {
    projectIdParamSchema.parse(req.params);
    return reply.send(
      ok({
        retentionDays: 90,
        strictPermissions: true
      })
    );
  });

  await registerCustomFieldsRoutes(app, deps);
  await registerStatusesRoutes(app, deps);
  await registerTemplatesRoutes(app, deps);
  await registerWebhooksRoutes(app, deps);
  await registerEmailOutboxRoutes(app, deps);
  await registerAuditRoutes(app, deps);
  await registerAttachmentRetentionRoutes(app, deps);
  await registerMembersRoutes(app, deps);
  await registerCustomRolesRoutes(app, deps);
  await registerWorkspacePreferencesRoutes(app, deps);
}
