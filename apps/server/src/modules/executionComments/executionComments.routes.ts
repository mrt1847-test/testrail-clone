import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

import { getAuthenticatedUser, requireProjectPermission } from "../../common/middlewares/authorization.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { recordExecutionCommentActivity } from "../activity/activity.service.js";
import {
  createExecutionComment,
  listExecutionComments,
  resolveRunCommentTarget,
  resolveTestInstanceCommentTarget,
  type ExecutionCommentRow
} from "./executionComments.service.js";
import { createExecutionCommentSchema, runIdParamSchema, testIdParamSchema } from "./executionComments.schema.js";

function commentToResponse(row: ExecutionCommentRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    entityType: row.entityType,
    entityId: row.entityId,
    parentId: row.parentId,
    content: row.content,
    createdAt: row.createdAt,
    author: row.author
      ? { id: row.author.id, email: row.author.email, name: row.author.name }
      : null
  };
}

export async function registerExecutionCommentsRoutes(
  app: FastifyInstance,
  deps: { authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/tests/:testId/execution-comments", async (req, reply) => {
    await requireProjectPermission(req, deps, "runs.read");
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "execution comments require prisma mode" });
    }
    const { testId } = testIdParamSchema.parse(req.params);
    await resolveTestInstanceCommentTarget(deps.prisma, testId);
    const items = await listExecutionComments(deps.prisma, {
      entityType: "test_instance",
      entityId: testId
    });
    return reply.send(toJsonSafe(ok(items.map(commentToResponse))));
  });

  app.post("/api/tests/:testId/execution-comments", async (req, reply) => {
    await requireProjectPermission(req, deps, "results.write");
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "execution comments require prisma mode" });
    }
    const user = await getAuthenticatedUser(req, deps);
    const { testId } = testIdParamSchema.parse(req.params);
    const body = createExecutionCommentSchema.parse(req.body ?? {});
    const target = await resolveTestInstanceCommentTarget(deps.prisma, testId);
    const created = await createExecutionComment(deps.prisma, {
      projectId: target.projectId,
      entityType: target.entityType,
      entityId: target.entityId,
      content: body.content,
      parentId: body.parentId,
      createdBy: user.id
    });
    await recordExecutionCommentActivity(deps.prisma, {
      commentId: created.id,
      projectId: target.projectId,
      entityType: target.entityType,
      entityId: target.entityId,
      content: body.content,
      actorUserId: user.id,
      contextTitle: target.contextTitle,
      runName: target.runName
    });
    return reply.send(toJsonSafe(ok(commentToResponse(created))));
  });

  app.get("/api/runs/:runId/execution-comments", async (req, reply) => {
    await requireProjectPermission(req, deps, "runs.read");
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "execution comments require prisma mode" });
    }
    const { runId } = runIdParamSchema.parse(req.params);
    await resolveRunCommentTarget(deps.prisma, runId);
    const items = await listExecutionComments(deps.prisma, {
      entityType: "test_run",
      entityId: runId
    });
    return reply.send(toJsonSafe(ok(items.map(commentToResponse))));
  });

  app.post("/api/runs/:runId/execution-comments", async (req, reply) => {
    await requireProjectPermission(req, deps, "results.write");
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_IMPLEMENTED", message: "execution comments require prisma mode" });
    }
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = createExecutionCommentSchema.parse(req.body ?? {});
    const target = await resolveRunCommentTarget(deps.prisma, runId);
    const created = await createExecutionComment(deps.prisma, {
      projectId: target.projectId,
      entityType: target.entityType,
      entityId: target.entityId,
      content: body.content,
      parentId: body.parentId,
      createdBy: user.id
    });
    await recordExecutionCommentActivity(deps.prisma, {
      commentId: created.id,
      projectId: target.projectId,
      entityType: target.entityType,
      entityId: target.entityId,
      content: body.content,
      actorUserId: user.id,
      contextTitle: target.contextTitle,
      runName: target.runName
    });
    return reply.send(toJsonSafe(ok(commentToResponse(created))));
  });
}
