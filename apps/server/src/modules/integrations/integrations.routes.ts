import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { requireAuthenticated, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { AuthService } from "../auth/auth.service.js";

const updateDefectIntegrationBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
  isEnabled: z.coerce.boolean().optional(),
  issueUrlTemplate: z.string().trim().min(1).optional().nullable(),
  defaultProjectKey: z.string().trim().min(1).optional().nullable()
});

type InMemoryDefectIntegrationSetting = {
  projectId: bigint;
  provider: string;
  isEnabled: boolean;
  issueUrlTemplate: string | null;
  defaultProjectKey: string | null;
};

const inMemorySettings = new Map<string, InMemoryDefectIntegrationSetting>();

function defaultSetting(projectId: bigint): InMemoryDefectIntegrationSetting {
  return {
    projectId,
    provider: "custom",
    isEnabled: false,
    issueUrlTemplate: null,
    defaultProjectKey: null
  };
}

export async function registerIntegrationsRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  app.get("/api/projects/:projectId/integrations/defects", async (req, reply) => {
    await requireAuthenticated(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      const row = inMemorySettings.get(projectId.toString()) ?? defaultSetting(projectId);
      return reply.send(toJsonSafe({ data: row }));
    }

    const row = await deps.prisma.defectIntegrationSetting.findFirst({
      where: { projectId, deletedAt: null }
    });
    return reply.send(
      toJsonSafe({
        data: {
          projectId,
          provider: row?.provider ?? "custom",
          isEnabled: row?.isEnabled ?? false,
          issueUrlTemplate: row?.issueUrlTemplate ?? null,
          defaultProjectKey: row?.defaultProjectKey ?? null
        }
      })
    );
  });

  app.patch("/api/projects/:projectId/integrations/defects", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = updateDefectIntegrationBodySchema.parse(req.body ?? {});
    if (!deps.prisma) {
      const current = inMemorySettings.get(projectId.toString()) ?? defaultSetting(projectId);
      const updated: InMemoryDefectIntegrationSetting = {
        projectId,
        provider: body.provider ?? current.provider,
        isEnabled: body.isEnabled ?? current.isEnabled,
        issueUrlTemplate: body.issueUrlTemplate !== undefined ? body.issueUrlTemplate : current.issueUrlTemplate,
        defaultProjectKey: body.defaultProjectKey !== undefined ? body.defaultProjectKey : current.defaultProjectKey
      };
      inMemorySettings.set(projectId.toString(), updated);
      return reply.send(toJsonSafe({ data: updated }));
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
        data: {
          projectId: updated.projectId,
          provider: updated.provider,
          isEnabled: updated.isEnabled,
          issueUrlTemplate: updated.issueUrlTemplate ?? null,
          defaultProjectKey: updated.defaultProjectKey ?? null
        }
      })
    );
  });
}
