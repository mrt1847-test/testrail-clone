import type { FastifyInstance } from "fastify";
import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import type { AuthService } from "../auth/auth.service.js";
import type { PrismaClient } from "@prisma/client";
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
  deps: { sectionsService: SectionsService; authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/suites/:suiteId/sections", async (req, reply) => {
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const items = await deps.sectionsService.listSections(suiteId);
    return reply.send(toJsonSafe(paged(items, page, pageSize)));
  });

  app.post("/api/suites/:suiteId/sections", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body = createSectionSchema.parse({
      suiteId,
      parentSectionId: raw.parentSectionId,
      name: raw.name
    });
    return reply.send(toJsonSafe(ok(await deps.sectionsService.createSection(body))));
  });

  app.patch("/api/sections/:sectionId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const body = updateSectionSchema.parse(req.body);
    return reply.send(toJsonSafe(ok(await deps.sectionsService.updateSection(sectionId, body))));
  });

  app.delete("/api/sections/:sectionId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    await deps.sectionsService.deleteSection(sectionId);
    return reply.status(204).send();
  });
}
