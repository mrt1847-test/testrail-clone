import type { FastifyInstance } from "fastify";
import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { SuitesService } from "./suites.service.js";
import {
  createSuiteSchema,
  projectIdParamSchema,
  suiteIdParamSchema,
  updateSuiteSchema
} from "./suites.schema.js";

export async function registerSuitesRoutes(app: FastifyInstance, deps: { suitesService: SuitesService }) {
  app.get("/api/projects/:projectId/suites", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const items = deps.suitesService.listSuites(projectId);
    return reply.send(toJsonSafe(paged(items, page, pageSize)));
  });

  app.post("/api/projects/:projectId/suites", async (req, reply) => {
    requireProjectMutationRole(req);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body = createSuiteSchema.parse({
      projectId,
      name: raw.name,
      description: raw.description
    });
    return reply.send(toJsonSafe(ok(deps.suitesService.createSuite(body))));
  });

  app.get("/api/suites/:suiteId", async (req, reply) => {
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(deps.suitesService.getSuite(suiteId))));
  });

  app.patch("/api/suites/:suiteId", async (req, reply) => {
    requireProjectMutationRole(req);
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const body = updateSuiteSchema.parse(req.body);
    return reply.send(toJsonSafe(ok(deps.suitesService.updateSuite(suiteId, body))));
  });

  app.delete("/api/suites/:suiteId", async (req, reply) => {
    requireProjectMutationRole(req);
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    deps.suitesService.deleteSuite(suiteId);
    return reply.status(204).send();
  });
}
