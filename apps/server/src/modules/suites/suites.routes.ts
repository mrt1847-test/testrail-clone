import type { FastifyInstance } from "fastify";
import { AppError } from "../../common/errors/appError.js";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import type { AuthService } from "../auth/auth.service.js";
import type { PrismaClient } from "@prisma/client";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import { SuitesService } from "./suites.service.js";
import {
  createBaselineSuiteSchema,
  createSuiteSchema,
  projectIdParamSchema,
  suiteIdParamSchema,
  updateSuiteSchema
} from "./suites.schema.js";

export async function registerSuitesRoutes(
  app: FastifyInstance,
  deps: { suitesService: SuitesService; authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/projects/:projectId/suites", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const items = await deps.suitesService.listSuites(projectId);
    return reply.send(toJsonSafe(paged(items, page, pageSize)));
  });

  app.post("/api/projects/:projectId/suites", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body = createSuiteSchema.parse({
      projectId,
      name: raw.name,
      description: raw.description,
      isBaseline: raw.isBaseline
    });
    let created;
    try {
      created = await deps.suitesService.createSuite(body);
    } catch (e) {
      if (e instanceof AppError && e.statusCode === 409) {
        return reply.code(409).send({ code: e.code, message: e.message });
      }
      throw e;
    }
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "suite",
      entityId: created.id,
      eventType: "suite.created",
      title: "Test suite created",
      body: created.name,
      payload: {
        suiteId: created.id.toString(),
        name: created.name,
        description: created.description ?? null
      }
    });
    return reply.send(toJsonSafe(ok(created)));
  });

  app.post("/api/projects/:projectId/suites/baselines", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = createBaselineSuiteSchema.parse(req.body ?? {});
    try {
      const created = await deps.suitesService.createBaselineSuite(projectId, body.name);
      await recordActivityEvent(deps.prisma, {
        projectId,
        actorUserId: user.id,
        entityType: "suite",
        entityId: created.id,
        eventType: "suite.created",
        title: "Baseline suite created",
        body: created.name,
        payload: {
          suiteId: created.id.toString(),
          isBaseline: true,
          parentSuiteId: created.parentSuiteId?.toString() ?? null
        }
      });
      return reply.send(toJsonSafe(ok(created)));
    } catch (e) {
      if (e instanceof AppError && e.statusCode === 409) {
        return reply.code(409).send({ code: e.code, message: e.message });
      }
      throw e;
    }
  });

  app.get("/api/suites/:suiteId", async (req, reply) => {
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    return reply.send(toJsonSafe(ok(await deps.suitesService.getSuite(suiteId))));
  });

  app.patch("/api/suites/:suiteId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const body = updateSuiteSchema.parse(req.body);
    const previous = await deps.suitesService.getSuite(suiteId);
    const updated = await deps.suitesService.updateSuite(suiteId, body);
    await recordActivityEvent(deps.prisma, {
      projectId: updated.projectId,
      actorUserId: user.id,
      entityType: "suite",
      entityId: updated.id,
      eventType: "suite.updated",
      title: "Test suite updated",
      body: updated.name,
      payload: {
        suiteId: updated.id.toString(),
        ...(body.name !== undefined ? { previousName: previous.name, name: updated.name } : {}),
        ...(body.description !== undefined
          ? { previousDescription: previous.description ?? null, description: updated.description ?? null }
          : {})
      }
    });
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.delete("/api/suites/:suiteId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const snapshot = await deps.suitesService.getSuite(suiteId);
    try {
      await deps.suitesService.deleteSuite(suiteId);
    } catch (e) {
      if (e instanceof AppError && e.statusCode === 409) {
        return reply.code(409).send({ code: e.code, message: e.message });
      }
      throw e;
    }
    await recordActivityEvent(deps.prisma, {
      projectId: snapshot.projectId,
      actorUserId: user.id,
      entityType: "suite",
      entityId: suiteId,
      eventType: "suite.deleted",
      title: "Test suite deleted",
      body: snapshot.name,
      payload: {
        suiteId: suiteId.toString(),
        name: snapshot.name
      }
    });
    return reply.status(204).send();
  });
}
