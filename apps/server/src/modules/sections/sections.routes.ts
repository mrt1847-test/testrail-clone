import type { FastifyInstance } from "fastify";
import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { SectionsService } from "./sections.service.js";
import {
  createSectionSchema,
  sectionIdParamSchema,
  suiteIdParamSchema,
  updateSectionSchema
} from "./sections.schema.js";

export async function registerSectionsRoutes(
  app: FastifyInstance,
  deps: { sectionsService: SectionsService }
) {
  app.get("/api/suites/:suiteId/sections", async (req, reply) => {
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const items = deps.sectionsService.listSections(suiteId);
    return reply.send(toJsonSafe(paged(items, page, pageSize)));
  });

  app.post("/api/suites/:suiteId/sections", async (req, reply) => {
    requireProjectMutationRole(req);
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body = createSectionSchema.parse({
      suiteId,
      parentSectionId: raw.parentSectionId,
      name: raw.name
    });
    return reply.send(toJsonSafe(ok(deps.sectionsService.createSection(body))));
  });

  app.patch("/api/sections/:sectionId", async (req, reply) => {
    requireProjectMutationRole(req);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const body = updateSectionSchema.parse(req.body);
    return reply.send(toJsonSafe(ok(deps.sectionsService.updateSection(sectionId, body))));
  });

  app.delete("/api/sections/:sectionId", async (req, reply) => {
    requireProjectMutationRole(req);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    deps.sectionsService.deleteSection(sectionId);
    return reply.status(204).send();
  });
}
