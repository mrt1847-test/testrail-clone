import type { FastifyInstance } from "fastify";
import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import type { AuthService } from "../auth/auth.service.js";
import type { PrismaClient } from "@prisma/client";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { CasesService } from "./cases.service.js";
import {
  caseIdParamSchema,
  createCaseSchema,
  createCaseStepSchema,
  listCasesQuerySchema,
  projectIdParamSchema,
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
      preconditions: raw.preconditions
    });
    return reply.send(toJsonSafe(ok(await deps.casesService.createCase(body))));
  });

  app.get("/api/cases/:caseId", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(await deps.casesService.getCase(caseId))));
  });

  app.get("/api/cases/:caseId/versions", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const rows = await deps.casesService.listCaseVersions(caseId);
    return reply.send(toJsonSafe(paged(rows, page, pageSize)));
  });

  app.patch("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = updateCaseSchema.parse(req.body);
    const ifMatchVersion = parseIfMatchVersion(req.headers["if-match"]);
    return reply.send(
      toJsonSafe(
        ok(
          await deps.casesService.updateCase(caseId, {
            ...body,
            expectedVersion: body.expectedVersion ?? ifMatchVersion
          })
        )
      )
    );
  });

  app.delete("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    await deps.casesService.deleteCase(caseId);
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
