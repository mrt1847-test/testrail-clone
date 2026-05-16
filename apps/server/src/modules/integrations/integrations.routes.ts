import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { requireAuthenticated, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { parseCaseRefs } from "../../domain/caseRefs.js";
import { resolveReferenceUrls } from "../../domain/referenceUrls.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { AuthService } from "../auth/auth.service.js";
import {
  loadDefectIntegration,
  searchIssueKeys,
  setInMemoryDefectIntegration,
  type DefectIntegrationRow
} from "./defectIntegration.service.js";

const updateDefectIntegrationBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
  isEnabled: z.coerce.boolean().optional(),
  issueUrlTemplate: z.string().trim().min(1).optional().nullable(),
  defaultProjectKey: z.string().trim().min(1).optional().nullable()
});

const referenceUrlsQuerySchema = z.object({
  keys: z.string().trim().min(1)
});

const issueSearchQuerySchema = z.object({
  q: z.string().default(""),
  limit: z.coerce.number().int().positive().max(25).default(10)
});

function toSettingResponse(row: DefectIntegrationRow) {
  return {
    projectId: row.projectId,
    provider: row.provider,
    isEnabled: row.isEnabled,
    issueUrlTemplate: row.issueUrlTemplate,
    defaultProjectKey: row.defaultProjectKey
  };
}

export async function registerIntegrationsRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  app.get("/api/projects/:projectId/integrations/defects", async (req, reply) => {
    await requireAuthenticated(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const row = await loadDefectIntegration(projectId, deps.prisma);
    return reply.send(toJsonSafe({ data: toSettingResponse(row) }));
  });

  app.patch("/api/projects/:projectId/integrations/defects", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = updateDefectIntegrationBodySchema.parse(req.body ?? {});
    if (!deps.prisma) {
      const current = await loadDefectIntegration(projectId, deps.prisma);
      const updated: DefectIntegrationRow = {
        projectId,
        provider: body.provider ?? current.provider,
        isEnabled: body.isEnabled ?? current.isEnabled,
        issueUrlTemplate: body.issueUrlTemplate !== undefined ? body.issueUrlTemplate : current.issueUrlTemplate,
        defaultProjectKey: body.defaultProjectKey !== undefined ? body.defaultProjectKey : current.defaultProjectKey
      };
      setInMemoryDefectIntegration(updated);
      return reply.send(toJsonSafe({ data: toSettingResponse(updated) }));
    }

    const updated = await deps.prisma.defectIntegrationSetting.upsert({
      where: { projectId },
      create: {
        projectId,
        provider: body.provider ?? "custom",
        isEnabled: body.isEnabled ?? false,
        issueUrlTemplate: body.issueUrlTemplate ?? null,
        defaultProjectKey: body.defaultProjectKey ?? null
      },
      update: {
        ...(body.provider !== undefined ? { provider: body.provider } : {}),
        ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
        ...(body.issueUrlTemplate !== undefined ? { issueUrlTemplate: body.issueUrlTemplate } : {}),
        ...(body.defaultProjectKey !== undefined ? { defaultProjectKey: body.defaultProjectKey } : {}),
        deletedAt: null
      }
    });
    return reply.send(
      toJsonSafe({
        data: toSettingResponse({
          projectId: updated.projectId,
          provider: updated.provider,
          isEnabled: updated.isEnabled,
          issueUrlTemplate: updated.issueUrlTemplate ?? null,
          defaultProjectKey: updated.defaultProjectKey ?? null
        })
      })
    );
  });

  app.get("/api/projects/:projectId/integrations/defects/reference-urls", async (req, reply) => {
    await requireAuthenticated(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { keys } = referenceUrlsQuerySchema.parse(req.query ?? {});
    const setting = await loadDefectIntegration(projectId, deps.prisma);
    const tokens = parseCaseRefs(keys);
    const items = resolveReferenceUrls(tokens, setting);
    return reply.send(toJsonSafe(ok({ items, integrationEnabled: setting.isEnabled })));
  });

  app.get("/api/projects/:projectId/integrations/defects/issues/search", async (req, reply) => {
    await requireAuthenticated(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { q, limit } = issueSearchQuerySchema.parse(req.query ?? {});
    const setting = await loadDefectIntegration(projectId, deps.prisma);
    const items = await searchIssueKeys(projectId, q, limit, deps.prisma, setting);
    return reply.send(toJsonSafe(ok({ items, integrationEnabled: setting.isEnabled })));
  });
}
