import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import {
  getAuthenticatedUser,
  requireProjectMutationRole,
  requireProjectPermission
} from "../../common/middlewares/authorization.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import type { AuthService } from "../auth/auth.service.js";
import { caseIdParamSchema } from "../cases/cases.schema.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { CasesService } from "../cases/cases.service.js";
import {
  createSharedStep,
  deleteSharedStep,
  getSharedStepForProject,
  listSharedStepsForProject,
  updateSharedStep
} from "./sharedSteps.service.js";

const sharedStepIdParamSchema = z.object({
  sharedStepId: z.coerce.bigint()
});

const sharedStepEntrySchema = z.object({
  content: z.string().min(1),
  expectedResult: z.string().nullable().optional()
});

const createSharedStepSchema = z.object({
  title: z.string().trim().min(1),
  entries: z.array(sharedStepEntrySchema).min(1).max(100)
});

const updateSharedStepSchema = z.object({
  title: z.string().trim().min(1).optional(),
  entries: z.array(sharedStepEntrySchema).min(1).max(100).optional()
});

export async function registerSharedStepsRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService; casesService: CasesService }
) {
  app.get("/api/projects/:projectId/shared-steps", async (req, reply) => {
    await requireProjectPermission(req, deps, "cases.read");
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) return reply.send(toJsonSafe([]));
    const rows = await listSharedStepsForProject(deps.prisma, projectId);
    return reply.send(toJsonSafe(rows));
  });

  app.get("/api/projects/:projectId/shared-steps/:sharedStepId", async (req, reply) => {
    await requireProjectPermission(req, deps, "cases.read");
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { sharedStepId } = sharedStepIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_FOUND", "shared step not found", 404);
    const row = await getSharedStepForProject(deps.prisma, projectId, sharedStepId);
    if (!row) throw new AppError("NOT_FOUND", "shared step not found", 404);
    return reply.send(toJsonSafe(row));
  });

  app.post("/api/projects/:projectId/shared-steps", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "cases.write" });
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = createSharedStepSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "shared steps API needs prisma mode", 501);
    const created = await createSharedStep(deps.prisma, {
      projectId,
      title: body.title,
      entries: body.entries,
      userId: user.id
    });
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "shared_step",
      entityId: created.id,
      eventType: "shared_step.created",
      title: "Shared step created",
      body: created.title,
      payload: { sharedStepId: created.id.toString(), title: created.title }
    });
    return reply.send(toJsonSafe(ok(created)));
  });

  app.patch("/api/projects/:projectId/shared-steps/:sharedStepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "cases.write" });
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { sharedStepId } = sharedStepIdParamSchema.parse(req.params);
    const body = updateSharedStepSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "shared steps API needs prisma mode", 501);
    const updated = await updateSharedStep(deps.prisma, {
      projectId,
      sharedStepId,
      title: body.title,
      entries: body.entries,
      userId: user.id
    });
    if (!updated) throw new AppError("NOT_FOUND", "shared step not found", 404);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "shared_step",
      entityId: sharedStepId,
      eventType: "shared_step.updated",
      title: "Shared step updated",
      body: updated.title,
      payload: { sharedStepId: sharedStepId.toString(), title: updated.title }
    });
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.delete("/api/projects/:projectId/shared-steps/:sharedStepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "cases.write" });
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { sharedStepId } = sharedStepIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "shared steps API needs prisma mode", 501);
    const deleted = await deleteSharedStep(deps.prisma, projectId, sharedStepId);
    if (!deleted) throw new AppError("NOT_FOUND", "shared step not found", 404);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "shared_step",
      entityId: sharedStepId,
      eventType: "shared_step.deleted",
      title: "Shared step deleted",
      payload: { sharedStepId: sharedStepId.toString() }
    });
    return reply.status(204).send();
  });

  app.post("/api/cases/:caseId/shared-steps/:sharedStepId", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "cases.write" });
    const user = await getAuthenticatedUser(req, deps);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const { sharedStepId } = sharedStepIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "shared steps API needs prisma mode", 501);
    const steps = await deps.casesService.linkSharedStep(caseId, sharedStepId, deps.prisma);
    const testCase = await deps.prisma.testCase.findFirst({
      where: { id: caseId },
      select: { projectId: true, title: true }
    });
    if (testCase) {
      await recordActivityEvent(deps.prisma, {
        projectId: testCase.projectId,
        actorUserId: user.id,
        entityType: "case",
        entityId: caseId,
        eventType: "case.shared_step_linked",
        title: "Shared step linked to case",
        body: testCase.title,
        payload: {
          caseId: caseId.toString(),
          sharedStepId: sharedStepId.toString(),
          stepCount: steps.length
        }
      });
    }
    return reply.send(toJsonSafe(ok(steps)));
  });
}
