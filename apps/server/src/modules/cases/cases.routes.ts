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
  listCasesQuerySchema,
  projectIdParamSchema,
  sectionIdParamSchema,
  updateCaseSchema
} from "./cases.schema.js";

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
      caseType: raw.caseType
    });
    return reply.send(toJsonSafe(ok(await deps.casesService.createCase(body))));
  });

  app.get("/api/cases/:caseId", async (req, reply) => {
    const { caseId } = caseIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(await deps.casesService.getCase(caseId))));
  });

  app.patch("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const body = updateCaseSchema.parse(req.body);
    return reply.send(toJsonSafe(ok(await deps.casesService.updateCase(caseId, body))));
  });

  app.delete("/api/cases/:caseId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    await deps.casesService.deleteCase(caseId);
    return reply.status(204).send();
  });
}
