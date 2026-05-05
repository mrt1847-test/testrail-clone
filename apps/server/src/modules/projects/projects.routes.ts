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
import { recordActivityEvent } from "../activity/activity.service.js";

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
    const created = await deps.projectsService.createProject({ ...body, ownerUserId: user.id });
    await recordActivityEvent(deps.prisma, {
      projectId: created.id,
      actorUserId: user.id,
      entityType: "project",
      entityId: created.id,
      eventType: "project.created",
      title: "Project created",
      body: created.name
    });
    return reply.send(toJsonSafe(ok(created)));
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
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = updateProjectSchema.parse(req.body);
    const updated = await deps.projectsService.updateProject(projectId, body);
    await recordActivityEvent(deps.prisma, {
      projectId: updated.id,
      actorUserId: user.id,
      entityType: "project",
      entityId: updated.id,
      eventType: "project.updated",
      title: "Project updated",
      body: updated.name
    });
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.delete("/api/projects/:projectId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const project = await deps.projectsService.getProject(projectId);
    await deps.projectsService.deleteProject(projectId);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "project",
      entityId: projectId,
      eventType: "project.deleted",
      title: "Project deleted",
      body: project.name
    });
    return reply.status(204).send();
  });
}
