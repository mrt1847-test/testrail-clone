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
  bulkArchiveCasesSchema,
  caseIdParamSchema,
  caseVersionIdParamSchema,
  bulkDeleteCasesSchema,
  bulkMoveCasesSchema,
  bulkUpdateCasesSchema,
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
      q: rawQuery.q,
      priority: rawQuery.priority,
      caseType: rawQuery.caseType,
      automation: rawQuery.automation,
      refs: rawQuery.refs,
      labels: rawQuery.labels,
      estimate: rawQuery.estimate,
      state: rawQuery.state
    });
    return reply.send(toJsonSafe(paged(await deps.casesService.listCases(query), page, pageSize)));
  });

  app.get("/api/sections/:sectionId/cases", async (req, reply) => {
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const rawQuery = (req.query ?? {}) as Record<string, unknown>;
    const { page, pageSize } = paginationQuerySchema.parse(rawQuery);
    const query = listCasesQuerySchema.parse({
      sectionId,
      q: rawQuery.q,
      priority: rawQuery.priority,
      caseType: rawQuery.caseType,
      automation: rawQuery.automation,
      refs: rawQuery.refs,
      labels: rawQuery.labels,
      estimate: rawQuery.estimate,
      state: rawQuery.state
    });
    return reply.send(toJsonSafe(paged(await deps.casesService.listCases(query), page, pageSize)));
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
        asCustomValues(body.customValues) ?? {}
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
          body: created.title,
          payload: { caseId: created.id.toString() }
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
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedCaseIds(projectId, body.caseIds);
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

  app.post("/api/projects/:projectId/cases/bulk-move", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = bulkMoveCasesSchema.parse(req.body ?? {});
    await deps.casesService.assertProjectScopedSection(projectId, body.targetSectionId);
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedCaseIds(projectId, body.caseIds);
    const result = await deps.casesService.bulkMoveCases(scopedIds, body.targetSectionId);
    const items = [
      ...result.items,
      ...outOfScope.map((caseId) => ({ caseId, success: false, error: "NOT_FOUND" }))
    ];
    const moved = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;

    if (moved > 0) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: "bulk-move",
        eventType: "case.bulk_moved",
        title: "Test cases bulk moved",
        body: `${moved} test case${moved === 1 ? "" : "s"} moved`,
        payload: {
          targetSectionId: body.targetSectionId.toString(),
          caseIds: items.filter((item) => item.success).map((item) => item.caseId.toString())
        }
      });
    }

    return reply.send(
      toJsonSafe(ok({ requested: body.caseIds.length, moved, failed, targetSectionId: body.targetSectionId, items }))
    );
  });

  app.post("/api/projects/:projectId/cases/bulk-update", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = bulkUpdateCasesSchema.parse(req.body ?? {});
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedCaseIds(projectId, body.caseIds);
    const result = await deps.casesService.bulkUpdateCases(scopedIds, body.patch);
    const items = [
      ...result.items,
      ...outOfScope.map((caseId) => ({ caseId, success: false, error: "NOT_FOUND" }))
    ];
    const updated = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;

    if (updated > 0) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: "bulk-update",
        eventType: "case.bulk_updated",
        title: "Test cases bulk updated",
        body: `${updated} test case${updated === 1 ? "" : "s"} updated`,
        payload: {
          patch: body.patch,
          caseIds: items.filter((item) => item.success).map((item) => item.caseId.toString())
        }
      });
    }

    return reply.send(toJsonSafe(ok({ requested: body.caseIds.length, updated, failed, patch: body.patch, items })));
  });

  app.post("/api/projects/:projectId/cases/bulk-archive", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const body = bulkArchiveCasesSchema.parse(req.body ?? {});
    const { scopedIds, outOfScope } = await deps.casesService.resolveProjectScopedCaseIds(projectId, body.caseIds);
    const result = await deps.casesService.bulkArchiveCases(scopedIds, body.archived);
    const items = [
      ...result.items,
      ...outOfScope.map((caseId) => ({ caseId, success: false, error: "NOT_FOUND" }))
    ];
    const changed = items.filter((item) => item.success).length;
    const failed = items.filter((item) => !item.success).length;

    if (changed > 0) {
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: body.archived ? "bulk-archive" : "bulk-restore",
        eventType: body.archived ? "case.bulk_archived" : "case.bulk_restored",
        title: body.archived ? "Test cases bulk archived" : "Test cases bulk restored",
        body: `${changed} test case${changed === 1 ? "" : "s"} ${body.archived ? "archived" : "restored"}`,
        payload: {
          archived: body.archived,
          caseIds: items.filter((item) => item.success).map((item) => item.caseId.toString())
        }
      });
    }

    return reply.send(
      toJsonSafe(ok({ requested: body.caseIds.length, changed, failed, archived: body.archived, items }))
    );
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
        payload: { caseId: restored.id.toString(), versionId: versionId.toString() }
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
        body: updated.title,
        payload: { caseId: updated.id.toString() }
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
    const user = await getAuthenticatedUser(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = createCaseStepSchema.parse(req.body ?? {});
    const created = await deps.casesService.createCaseStep(caseId, body);
    const projectId = await deps.casesService.projectIdForCase(deps.prisma, caseId);
    if (projectId && deps.prisma) {
      const preview =
        created.content.length > 160 ? `${created.content.slice(0, 157).trimEnd()}…` : created.content;
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: caseId,
        eventType: "case.step_created",
        title: "Case step added",
        body: preview,
        payload: {
          caseId: caseId.toString(),
          stepId: created.id.toString(),
          stepOrder: created.stepOrder
        }
      });
    }
    return reply.send(toJsonSafe(ok(created)));
  });

  app.patch("/api/case-steps/:stepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    const body = updateCaseStepSchema.parse(req.body ?? {});
    let stepContext: { caseId: bigint; projectId: bigint } | null = null;
    if (deps.prisma) {
      const row = await deps.prisma.testCaseStep.findFirst({
        where: { id: stepId, deletedAt: null },
        select: { caseId: true, case: { select: { projectId: true } } }
      });
      if (row) stepContext = { caseId: row.caseId, projectId: row.case.projectId };
    }
    const updated = await deps.casesService.updateCaseStep(stepId, body);
    if (stepContext && deps.prisma) {
      const preview =
        updated.content.length > 160 ? `${updated.content.slice(0, 157).trimEnd()}…` : updated.content;
      await recordActivityEvent(deps.prisma, {
        projectId: stepContext.projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: stepContext.caseId,
        eventType: "case.step_updated",
        title: "Case step updated",
        body: preview,
        payload: { caseId: stepContext.caseId.toString(), stepId: stepId.toString() }
      });
    }
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.delete("/api/case-steps/:stepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { stepId } = stepIdParamSchema.parse(req.params);
    let stepContext: { caseId: bigint; projectId: bigint } | null = null;
    if (deps.prisma) {
      const row = await deps.prisma.testCaseStep.findFirst({
        where: { id: stepId, deletedAt: null },
        select: { caseId: true, case: { select: { projectId: true } } }
      });
      if (row) stepContext = { caseId: row.caseId, projectId: row.case.projectId };
    }
    await deps.casesService.deleteCaseStep(stepId);
    if (stepContext && deps.prisma) {
      await recordActivityEvent(deps.prisma, {
        projectId: stepContext.projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: stepContext.caseId,
        eventType: "case.step_deleted",
        title: "Case step removed",
        body: `Step ${stepId.toString()}`,
        payload: { caseId: stepContext.caseId.toString(), stepId: stepId.toString() }
      });
    }
    return reply.status(204).send();
  });
}
