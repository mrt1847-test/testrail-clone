import type { FastifyInstance } from "fastify";
import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { createProjectSchema, projectIdParamSchema, updateProjectSchema } from "./projects.schema.js";
import { ProjectsService } from "./projects.service.js";

export async function registerProjectsRoutes(
  app: FastifyInstance,
  deps: { projectsService: ProjectsService }
) {
  app.get("/api/projects", async (req, reply) => {
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const items = deps.projectsService.listProjects();
    return reply.send(toJsonSafe(paged(items, page, pageSize)));
  });

  app.post("/api/projects", async (req, reply) => {
    requireProjectMutationRole(req);
    const body = createProjectSchema.parse(req.body);
    return reply.send(toJsonSafe(ok(deps.projectsService.createProject(body))));
  });

  app.get("/api/projects/:projectId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(deps.projectsService.getProject(projectId))));
  });

  app.patch("/api/projects/:projectId", async (req, reply) => {
    requireProjectMutationRole(req);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = updateProjectSchema.parse(req.body);
    return reply.send(toJsonSafe(ok(deps.projectsService.updateProject(projectId, body))));
  });

  app.delete("/api/projects/:projectId", async (req, reply) => {
    requireProjectMutationRole(req);
    const { projectId } = projectIdParamSchema.parse(req.params);
    deps.projectsService.deleteProject(projectId);
    return reply.status(204).send();
  });
}
