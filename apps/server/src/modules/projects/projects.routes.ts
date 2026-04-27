import type { FastifyInstance } from "fastify";
import {
  getAuthenticatedUser,
  requireProjectMutationRole
} from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { createProjectSchema, projectIdParamSchema, updateProjectSchema } from "./projects.schema.js";
import { ProjectsService } from "./projects.service.js";
import type { PrismaClient } from "@prisma/client";

export async function registerProjectsRoutes(
  app: FastifyInstance,
  deps: { projectsService: ProjectsService; authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/projects", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (deps.prisma) {
      const items = await deps.prisma.project.findMany({
        where: {
          deletedAt: null,
          members: { some: { userId: user.id, deletedAt: null } }
        },
        orderBy: { id: "desc" },
        select: { id: true, name: true, description: true }
      });
      return reply.send(toJsonSafe(paged(items, page, pageSize)));
    }
    const items = await deps.projectsService.listProjects();
    return reply.send(toJsonSafe(paged(items, page, pageSize)));
  });

  app.post("/api/projects", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const body = createProjectSchema.parse(req.body);
    return reply.send(
      toJsonSafe(ok(await deps.projectsService.createProject({ ...body, ownerUserId: user.id })))
    );
  });

  app.get("/api/projects/:projectId", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (deps.prisma) {
      const hasMembership = await deps.prisma.projectMember.findFirst({
        where: { projectId, userId: user.id, deletedAt: null },
        select: { id: true }
      });
      if (!hasMembership) {
        return reply.status(403).send({ code: "FORBIDDEN", message: "project access denied" });
      }
    }
    return reply.send(toJsonSafe(ok(await deps.projectsService.getProject(projectId))));
  });

  app.patch("/api/projects/:projectId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = updateProjectSchema.parse(req.body);
    return reply.send(toJsonSafe(ok(await deps.projectsService.updateProject(projectId, body))));
  });

  app.delete("/api/projects/:projectId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    await deps.projectsService.deleteProject(projectId);
    return reply.status(204).send();
  });
}
