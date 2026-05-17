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
  normalizeDefectProvider,
  testDefectIntegrationConnection,
  validateDefectIntegrationConfig
} from "../../domain/defectIntegrationValidation.js";
import { AppError } from "../../common/errors/appError.js";
import { buildDefectTemplatePreview } from "../../domain/defectProviderApi.js";
import {
  loadDefectIntegration,
  searchIssueKeys,
  setInMemoryDefectIntegration,
  toDefectIntegrationPublicResponse,
  type DefectIntegrationRow
} from "./defectIntegration.service.js";
import { getDefectPushFieldsForProject } from "./defectPush.service.js";

const createModeSchema = z.enum(["url_template", "provider_api"]);

const updateDefectIntegrationBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
  isEnabled: z.coerce.boolean().optional(),
  createMode: createModeSchema.optional(),
  issueUrlTemplate: z.string().trim().min(1).optional().nullable(),
  defaultProjectKey: z.string().trim().min(1).optional().nullable(),
  apiBaseUrl: z.string().trim().min(1).optional().nullable(),
  apiToken: z.string().trim().min(1).optional().nullable(),
  clearApiToken: z.coerce.boolean().optional()
});

const testDefectIntegrationBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
  isEnabled: z.coerce.boolean().optional(),
  createMode: createModeSchema.optional(),
  issueUrlTemplate: z.string().trim().min(1).optional().nullable(),
  defaultProjectKey: z.string().trim().min(1).optional().nullable(),
  apiBaseUrl: z.string().trim().min(1).optional().nullable(),
  apiToken: z.string().trim().min(1).optional().nullable(),
  sampleIssueKey: z.string().trim().min(1).max(64).optional()
});

function mergeDefectIntegrationRow(
  current: DefectIntegrationRow,
  body: z.infer<typeof updateDefectIntegrationBodySchema>
): DefectIntegrationRow {
  let apiToken = current.apiToken;
  if (body.clearApiToken) apiToken = null;
  else if (body.apiToken !== undefined) apiToken = body.apiToken;

  return {
    projectId: current.projectId,
    provider: body.provider !== undefined ? normalizeDefectProvider(body.provider) : current.provider,
    isEnabled: body.isEnabled ?? current.isEnabled,
    createMode: body.createMode ?? current.createMode,
    issueUrlTemplate:
      body.issueUrlTemplate !== undefined ? body.issueUrlTemplate : current.issueUrlTemplate,
    defaultProjectKey:
      body.defaultProjectKey !== undefined ? body.defaultProjectKey : current.defaultProjectKey,
    apiBaseUrl: body.apiBaseUrl !== undefined ? body.apiBaseUrl : current.apiBaseUrl,
    apiToken
  };
}

function assertDefectIntegrationValid(row: DefectIntegrationRow) {
  const validation = validateDefectIntegrationConfig(row);
  if (!validation.valid) {
    throw new AppError("VALIDATION_ERROR", validation.errors.join(" "), 400, {
      errors: validation.errors,
      warnings: validation.warnings
    });
  }
}

const referenceUrlsQuerySchema = z.object({
  keys: z.string().trim().min(1)
});

const issueSearchQuerySchema = z.object({
  q: z.string().default(""),
  limit: z.coerce.number().int().positive().max(25).default(10)
});

const pushFieldsQuerySchema = z.object({
  provider: z.string().trim().optional(),
  runId: z.coerce.bigint().optional(),
  testId: z.coerce.bigint().optional(),
  resultId: z.coerce.bigint().optional(),
  resultStatus: z.string().trim().optional(),
  resultComment: z.string().trim().optional(),
  testTitle: z.string().trim().optional(),
  runName: z.string().trim().optional()
});

const templatePreviewQuerySchema = z.object({
  sampleIssueKey: z.string().trim().min(1).max(64).optional(),
  provider: z.string().trim().optional(),
  createMode: createModeSchema.optional(),
  issueUrlTemplate: z.string().trim().min(1).optional().nullable(),
  defaultProjectKey: z.string().trim().min(1).optional().nullable()
});

export async function registerIntegrationsRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  app.get("/api/projects/:projectId/integrations/defects", async (req, reply) => {
    await requireAuthenticated(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const row = await loadDefectIntegration(projectId, deps.prisma);
    return reply.send(toJsonSafe({ data: toDefectIntegrationPublicResponse(row) }));
  });

  app.patch("/api/projects/:projectId/integrations/defects", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = updateDefectIntegrationBodySchema.parse(req.body ?? {});
    const current = await loadDefectIntegration(projectId, deps.prisma);
    const merged = mergeDefectIntegrationRow(current, body);
    assertDefectIntegrationValid(merged);

    if (!deps.prisma) {
      setInMemoryDefectIntegration(merged);
      return reply.send(toJsonSafe({ data: toDefectIntegrationPublicResponse(merged) }));
    }

    const updated = await deps.prisma.defectIntegrationSetting.upsert({
      where: { projectId },
      create: {
        projectId,
        provider: merged.provider,
        isEnabled: merged.isEnabled,
        createMode: merged.createMode,
        issueUrlTemplate: merged.issueUrlTemplate,
        defaultProjectKey: merged.defaultProjectKey,
        apiBaseUrl: merged.apiBaseUrl,
        apiToken: merged.apiToken
      },
      update: {
        provider: merged.provider,
        isEnabled: merged.isEnabled,
        createMode: merged.createMode,
        issueUrlTemplate: merged.issueUrlTemplate,
        defaultProjectKey: merged.defaultProjectKey,
        apiBaseUrl: merged.apiBaseUrl,
        apiToken: merged.apiToken,
        deletedAt: null
      }
    });
    return reply.send(
      toJsonSafe({
        data: toDefectIntegrationPublicResponse({
          projectId: updated.projectId,
          provider: updated.provider,
          isEnabled: updated.isEnabled,
          createMode: updated.createMode,
          issueUrlTemplate: updated.issueUrlTemplate ?? null,
          defaultProjectKey: updated.defaultProjectKey ?? null,
          apiBaseUrl: updated.apiBaseUrl ?? null,
          apiToken: updated.apiToken ?? null
        })
      })
    );
  });

  app.get("/api/projects/:projectId/integrations/defects/template-preview", async (req, reply) => {
    await requireAuthenticated(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = templatePreviewQuerySchema.parse(req.query ?? {});
    const current = await loadDefectIntegration(projectId, deps.prisma);
    const draft = mergeDefectIntegrationRow(current, query);
    const preview = buildDefectTemplatePreview(
      {
        provider: draft.provider,
        isEnabled: true,
        createMode: draft.createMode,
        issueUrlTemplate: draft.issueUrlTemplate,
        defaultProjectKey: draft.defaultProjectKey,
        apiBaseUrl: draft.apiBaseUrl,
        apiToken: draft.apiToken
      },
      query.sampleIssueKey ?? ""
    );
    return reply.send(toJsonSafe(ok(preview)));
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

  app.get("/api/projects/:projectId/integrations/defects/push-fields", async (req, reply) => {
    await requireAuthenticated(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = pushFieldsQuerySchema.parse(req.query ?? {});
    const context =
      query.resultId && query.runId && query.testId
        ? {
            projectId: projectId.toString(),
            runId: query.runId.toString(),
            runName: query.runName ?? `Run ${query.runId.toString()}`,
            testId: query.testId.toString(),
            testTitle: query.testTitle ?? `Test ${query.testId.toString()}`,
            resultId: query.resultId.toString(),
            resultStatus: query.resultStatus ?? "failed",
            resultComment: query.resultComment ?? null
          }
        : undefined;
    const payload = await getDefectPushFieldsForProject(projectId, query.provider, context, deps.prisma);
    return reply.send(toJsonSafe(ok(payload)));
  });

  app.post("/api/projects/:projectId/integrations/defects/test-connection", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = testDefectIntegrationBodySchema.parse(req.body ?? {});
    const current = await loadDefectIntegration(projectId, deps.prisma);
    const draft = mergeDefectIntegrationRow(current, body);
    const result = testDefectIntegrationConnection(draft, {
      sampleIssueKey: body.sampleIssueKey
    });
    return reply.send(toJsonSafe(ok(result)));
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
