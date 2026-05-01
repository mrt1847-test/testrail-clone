import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import type { AuthService } from "../auth/auth.service.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { CasesService } from "./cases.service.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import {
  caseIdParamSchema,
  caseVersionIdParamSchema,
  bulkDeleteCasesSchema,
  createCaseSchema,
  createCaseStepSchema,
  listCasesQuerySchema,
  projectIdParamSchema,
  restoreCaseVersionSchema,
  sectionIdParamSchema,
  stepIdParamSchema,
  updateCaseSchema,
  updateCaseStepSchema
} from "./cases.schema.js";

function parseIfMatchVersion(value?: string | string[]): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const normalized = raw.replace(/^W\//i, "").replace(/"/g, "").trim();
  const num = Number(normalized);
  if (!Number.isInteger(num) || num < 1) return undefined;
  return num;
}

type ScalarCustomValue = string | number | boolean | null;
type CustomValues = Record<string, ScalarCustomValue>;

function asCustomValues(value: unknown): CustomValues | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CustomValues = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
      out[key] = item;
    }
  }
  return out;
}

export async function registerCasesRoutes(
  app: FastifyInstance,
  deps: { casesService: CasesService; authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/projects/:projectId/cases", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const rawQuery = (req.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = paginationQuerySchema.parse(rawQuery);
    const query = listCasesQuerySchema.parse({
      projectId,
      suiteId: rawQuery.suiteId,
      sectionId: rawQuery.sectionId,
      q: rawQuery.q
    });
    return reply.send(toJsonSafe(paged(await deps.casesService.listCases(query), page, pageSize)));
  });

  app.get("/api/sections/:sectionId/cases", async (req, reply) => {
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    return reply.send(toJsonSafe(paged(await deps.casesService.listCases({ sectionId }), page, pageSize)));
  });

  app.post("/api/sections/:sectionId/cases", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body = createCaseSchema.parse({
      sectionId,
      title: raw.title,
      priority: raw.priority,
      caseType: raw.caseType,
      preconditions: raw.preconditions,
      customValues: raw.customValues
    });
    try {
      const user = await getAuthenticatedUser(req, deps);
      const customValues = await deps.casesService.validateCaseCustomValues(
        deps.prisma,
        await deps.casesService.projectIdForSection(deps.prisma, sectionId),
        asCustomValues(body.customValues)
      );
      const created = await deps.casesService.createCase({ ...body, customValues });
      if (created.projectId) {
        await recordActivityEvent(deps.prisma, {
          projectId: created.projectId,
          actorUserId: user.id,
          entityType: "case",
          entityId: created.id,
          eventType: "case.created",
          title: "Test case created",
          body: created.title
        });
      }
      return reply.send(toJsonSafe(ok(created)));
    } catch (e) {
      const customFieldError = deps.casesService.customFieldErrorResponse(e);
      if (customFieldError) return reply.code(400).send(customFieldError);
      throw e;
    }
  });

  app.get("/api/cases/:caseId", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(await deps.casesService.getCase(caseId))));
  });

  app.post("/api/projects/:projectId/cases/bulk-delete", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = bulkDeleteCasesSchema.parse(req.body ?? {});
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedBulkDelete(projectId, body.caseIds);
    const result = await deps.casesService.bulkDeleteCases(scopedIds);
    const items = [
      ...result.items,
      ...outOfScope.map((caseId) => ({ caseId, success: false, error: "NOT_FOUND" }))
    ];
    const deleted = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;

    if (deleted > 0) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: "bulk-delete",
        eventType: "case.bulk_deleted",
        title: "Test cases bulk deleted",
        body: `${deleted} test case${deleted === 1 ? "" : "s"} deleted`,
        payload: { caseIds: items.filter((item) => item.success).map((item) => item.caseId.toString()) }
      });
    }

    return reply.send(toJsonSafe(ok({ requested: body.caseIds.length, deleted, failed, items })));
  });

  app.get("/api/cases/:caseId/versions", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const rows = await deps.casesService.listCaseVersions(caseId);
    return reply.send(toJsonSafe(paged(rows, page, pageSize)));
  });

  app.get("/api/cases/:caseId/versions/:versionId", async (req, reply) => {
    const { caseId, versionId } = caseVersionIdParamSchema.parse(req.params);
    const row = await deps.casesService.getCaseVersion(caseId, versionId);
    return reply.send(toJsonSafe(ok(row)));
  });

  app.post("/api/cases/:caseId/versions/:versionId/restore", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId, versionId } = caseVersionIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = restoreCaseVersionSchema.parse(req.body ?? {});
    const ifMatchVersion = parseIfMatchVersion(req.headers["if-match"]);
    const restored = await deps.casesService.restoreCaseVersion(caseId, versionId, body.expectedVersion ?? ifMatchVersion);
    if (restored.projectId) {
      await recordActivityEvent(deps.prisma, {
        projectId: restored.projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: restored.id,
        eventType: "case.version_restored",
        title: "Test case version restored",
        body: restored.title,
        payload: { versionId: versionId.toString() }
      });
    }
    return reply.send(toJsonSafe(ok(restored)));
  });

  app.patch("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = updateCaseSchema.parse(req.body);
    const ifMatchVersion = parseIfMatchVersion(req.headers["if-match"]);
    const customValues = await deps.casesService.validateCaseCustomValues(
      deps.prisma,
      await deps.casesService.projectIdForCase(deps.prisma, caseId),
      asCustomValues(body.customValues)
    ).catch((e) => {
      const customFieldError = deps.casesService.customFieldErrorResponse(e);
      if (customFieldError) return customFieldError;
      throw e;
    });
    if (customValues && "code" in customValues) return reply.code(400).send(customValues);
    const updated = await deps.casesService.updateCase(caseId, {
      ...body,
      customValues,
      expectedVersion: body.expectedVersion ?? ifMatchVersion
    });
    if (updated.projectId) {
      await recordActivityEvent(deps.prisma, {
        projectId: updated.projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: updated.id,
        eventType: "case.updated",
        title: "Test case updated",
        body: updated.title
      });
    }
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.delete("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const projectId = await deps.casesService.projectIdForCase(deps.prisma, caseId);
    await deps.casesService.deleteCase(caseId);
    if (projectId) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: caseId,
        eventType: "case.deleted",
        title: "Test case deleted"
      });
    }
    return reply.status(204).send();
  });

  app.post("/api/cases/:caseId/steps", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = createCaseStepSchema.parse(req.body ?? {});
    return reply.send(toJsonSafe(ok(await deps.casesService.createCaseStep(caseId, body))));
  });

  app.patch("/api/case-steps/:stepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    const body = updateCaseStepSchema.parse(req.body ?? {});
    return reply.send(toJsonSafe(ok(await deps.casesService.updateCaseStep(stepId, body))));
  });

  app.delete("/api/case-steps/:stepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    await deps.casesService.deleteCaseStep(stepId);
    return reply.status(204).send();
  });
}
