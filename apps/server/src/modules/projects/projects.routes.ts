import type { FastifyInstance } from "fastify";
import { z } from "zod";
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
import { ensureDefaultCaseTemplates, ensureDefaultCaseTemplatesInMemory } from "../settings/caseTemplates.service.js";
import { caseTemplates } from "../settings/settings.shared.js";
import { getAccessDefaults, grantActiveUsersToProject } from "../admin/accessDefaults.service.js";
import { searchCrossProjectGlobal } from "./crossProjectGlobalSearch.service.js";
import { searchProjectGlobal } from "./projectGlobalSearch.service.js";

const projectSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().positive().max(20).optional()
});

export async function registerProjectsRoutes(
  app: FastifyInstance,
  deps: { projectsService: ProjectsService; authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/search", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const query = projectSearchQuerySchema.parse(req.query ?? {});
    const result = await searchCrossProjectGlobal(deps.prisma, {
      userId: user.id,
      query: query.q,
      limitPerType: query.limit
    });
    return reply.send(toJsonSafe(ok(result)));
  });

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
        select: { id: true, name: true, description: true, projectType: true, isActive: true }
      });
      const mapped = items.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        projectType: row.projectType,
        isArchived: !row.isActive
      }));
      return reply.send(toJsonSafe(paged(mapped, page, pageSize)));
    }
    const items = await deps.projectsService.listProjects();
    return reply.send(toJsonSafe(paged(items, page, pageSize)));
  });

  app.post("/api/projects", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const body = createProjectSchema.parse(req.body);
    const created = await deps.projectsService.createProject({
      name: body.name,
      description: body.description,
      projectType: body.projectType,
      ownerUserId: user.id
    });
    if (deps.prisma) {
      await ensureDefaultCaseTemplates(deps.prisma, created.id, user.id);
    } else {
      ensureDefaultCaseTemplatesInMemory(created.id, caseTemplates);
    }
    if (deps.prisma) {
      const accessDefaults = await getAccessDefaults(deps.prisma);
      if (accessDefaults.newProjectAccessMode === "all_active_users") {
        await deps.prisma.$transaction((tx) =>
          grantActiveUsersToProject(tx, {
            projectId: created.id,
            creatorUserId: user.id,
            role: accessDefaults.defaultProjectMemberRole
          })
        );
      }
    }
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

  app.get("/api/projects/:projectId/search", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = projectSearchQuerySchema.parse(req.query ?? {});
    if (deps.prisma) {
      const hasMembership = await deps.prisma.projectMember.findFirst({
        where: { projectId, userId: user.id, deletedAt: null },
        select: { id: true }
      });
      if (!hasMembership) {
        return reply.status(403).send({ code: "FORBIDDEN", message: "project access denied" });
      }
    }
    const result = await searchProjectGlobal(deps.prisma, {
      projectId,
      query: query.q,
      limitPerType: query.limit
    });
    return reply.send(toJsonSafe(ok(result)));
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

  app.post("/api/projects/:projectId/archive", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { skipArchivedCheck: true });
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const updated = await deps.projectsService.setProjectArchived(projectId, true);
    await recordActivityEvent(deps.prisma, {
      projectId: updated.id,
      actorUserId: user.id,
      entityType: "project",
      entityId: updated.id,
      eventType: "project.archived",
      title: "Project archived",
      body: updated.name
    });
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.post("/api/projects/:projectId/restore", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { skipArchivedCheck: true });
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const updated = await deps.projectsService.setProjectArchived(projectId, false);
    await recordActivityEvent(deps.prisma, {
      projectId: updated.id,
      actorUserId: user.id,
      entityType: "project",
      entityId: updated.id,
      eventType: "project.restored",
      title: "Project restored",
      body: updated.name
    });
    return reply.send(toJsonSafe(ok(updated)));
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
