import type { FastifyInstance } from "fastify";

import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { AppError } from "../../common/errors/appError.js";
import type { AuthService } from "../auth/auth.service.js";
import type { PrismaClient } from "@prisma/client";
import type { ResultsService } from "../results/results.service.js";
import { byCaseSchema, bulkSchema, runResultSchema } from "../results/results.schema.js";
import { resultCustomFieldErrorResponse, validateResultCustomValues } from "../results/resultCustomValues.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { RunsService } from "./runs.service.js";
import {
  addCasesToRunBodySchema,
  createProjectRunSchema,
  removeTestFromRunBodySchema,
  rerunSchema,
  runInstancesQuerySchema,
  runIdParamSchema,
  testIdParamSchema,
  updateRunSchema,
  updateTestAssigneeSchema
} from "./runs.schema.js";
import { calculateRunSummary } from "../reports/reports.service.js";
import type { RunsRepository } from "./runs.repository.js";
import { recordActivityEvent, recordResultActivity } from "../activity/activity.service.js";

async function projectIdForRun(repo: RunsRepository, runId: bigint) {
  const run = await repo.getRun(runId);
  return run?.projectId ?? null;
}

export async function registerRunsRoutes(
  app: FastifyInstance,
  deps: {
    runsService: RunsService;
    resultsService: ResultsService;
    repo: RunsRepository;
    authService: AuthService;
    prisma?: PrismaClient;
  }
) {
  app.get("/api/projects/:projectId/runs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const items = await deps.repo.listRunsByProject(projectId);
    return reply.send(toJsonSafe(paged(items, page, pageSize)));
  });

  app.get("/api/runs/:runId", async (req, reply) => {
    const { runId } = runIdParamSchema.parse(req.params);
    const run = await deps.repo.getRun(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const instances = await deps.repo.listInstancesForRun(runId);
    return reply.send(toJsonSafe(ok({ run, instances })));
  });

  app.get("/api/projects/:projectId/runs/:runId", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    const { includeInstances } = runInstancesQuerySchema.parse(req.query ?? {});
    const run = await deps.repo.getRun(runId);
    if (!run || run.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const instances = includeInstances === false ? [] : await deps.repo.listInstancesForRun(runId);
    return reply.send(toJsonSafe(ok({ run, instances })));
  });

  app.get("/api/projects/:projectId/runs/:runId/instances", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const { status, assignedTo, q } = runInstancesQuerySchema.parse(req.query ?? {});
    const run = await deps.repo.getRun(runId);
    if (!run || run.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const { items, total } = await deps.repo.listInstancesForRunPage({
      runId,
      page,
      pageSize,
      status,
      assignedTo,
      q
    });
    return reply.send(
      toJsonSafe({
        data: items,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      })
    );
  });

  app.post("/api/projects/:projectId/runs", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const raw = createProjectRunSchema.parse(req.body);
    const body = { ...raw, projectId };
    const created = await deps.runsService.createRunWithInstances(body);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: created.run.id,
      eventType: "run.created",
      title: "Test run created",
      body: created.run.name,
      payload: {
        runId: created.run.id.toString(),
        suiteId: created.run.suiteId.toString(),
        includeAll: body.includeAll,
        caseIds: (body.caseIds ?? []).map((id) => id.toString()),
        excludedCaseIds: (body.excludedCaseIds ?? []).map((id) => id.toString()),
        includedSectionIds: (body.includedSectionIds ?? []).map((id) => id.toString()),
        excludedSectionIds: (body.excludedSectionIds ?? []).map((id) => id.toString())
      }
    });
    return reply.send(toJsonSafe(created));
  });

  app.patch("/api/runs/:runId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = updateRunSchema.parse(req.body);
    const updated = await deps.runsService.updateRun(runId, body);
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.patch("/api/runs/:runId/assignee", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = updateRunSchema.parse(req.body);
    const updated = await deps.runsService.updateRun(runId, { assignedTo: body.assignedTo ?? null });
    await recordActivityEvent(deps.prisma, {
      projectId: updated.projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: updated.id,
      eventType: "run.assigned",
      title: "Run assignment changed",
      body: updated.name,
      payload: { assignedTo: updated.assignedTo?.toString() ?? null },
      notificationType: "assignment"
    });
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.post("/api/runs/:runId/results/by-case", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const params = runIdParamSchema.parse(req.params);
    const body = byCaseSchema.parse(req.body);
    const projectId = await projectIdForRun(deps.repo, params.runId);
    try {
      body.customValues = await validateResultCustomValues(deps.prisma, projectId, body.customValues);
    } catch (e) {
      const customFieldError = resultCustomFieldErrorResponse(e);
      if (customFieldError) return reply.code(400).send(customFieldError);
      throw e;
    }
    const created = await deps.resultsService.addResultForCaseInRun(params.runId, body.caseId, body);
    await recordResultActivity(deps.prisma, { resultId: created.id, actorUserId: user.id });
    return reply.send(toJsonSafe(created));
  });

  app.post("/api/runs/:runId/results/bulk", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const params = runIdParamSchema.parse(req.params);
    const body = bulkSchema.parse(req.body);
    const projectId = await projectIdForRun(deps.repo, params.runId);
    try {
      for (const item of body.results) {
        item.customValues = await validateResultCustomValues(deps.prisma, projectId, item.customValues);
      }
    } catch (e) {
      const customFieldError = resultCustomFieldErrorResponse(e);
      if (customFieldError) return reply.code(400).send(customFieldError);
      throw e;
    }
    const res = await deps.resultsService.bulkAddResults({
      runId: params.runId,
      atomic: body.atomic,
      results: body.results.map((item) => ({
        ...item,
        caseId: item.caseId as bigint
      }))
    });
    for (const item of res.items) {
      if (item.status === "saved") {
        await recordResultActivity(deps.prisma, { resultId: item.resultId, actorUserId: user.id });
      }
    }
    return reply.send(toJsonSafe(res));
  });

  app.post("/api/runs/:runId/results", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = runResultSchema.parse(req.body);
    const projectId = await projectIdForRun(deps.repo, runId);
    try {
      body.customValues = await validateResultCustomValues(deps.prisma, projectId, body.customValues);
    } catch (e) {
      const customFieldError = resultCustomFieldErrorResponse(e);
      if (customFieldError) return reply.code(400).send(customFieldError);
      throw e;
    }
    if (body.testId) {
      const instances = await deps.repo.listInstancesForRun(runId);
      const exists = instances.some((instance) => instance.id === body.testId);
      if (!exists) {
        throw new AppError(
          "TEST_NOT_FOUND_IN_RUN",
          `test ${body.testId.toString()} not found in run ${runId.toString()}`,
          404
        );
      }
      const created = await deps.resultsService.addResultToTestInstance(body.testId, body);
      await recordResultActivity(deps.prisma, { resultId: created.id, actorUserId: user.id });
      return reply.send(toJsonSafe(created));
    }
    if (!body.caseId) {
      throw new AppError("VALIDATION_ERROR", "caseId is required", 400);
    }
    const created = await deps.resultsService.addResultForCaseInRun(runId, body.caseId, body);
    await recordResultActivity(deps.prisma, { resultId: created.id, actorUserId: user.id });
    return reply.send(toJsonSafe(created));
  });

  app.post("/api/runs/:runId/close", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const closed = await deps.runsService.closeRun(runId);
    await recordActivityEvent(deps.prisma, {
      projectId: closed.projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: closed.id,
      eventType: "run.closed",
      title: "Test run closed",
      body: closed.name
    });
    return reply.send(toJsonSafe(ok(closed)));
  });

  app.post("/api/runs/:runId/reopen", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const reopened = await deps.runsService.reopenRun(runId);
    await recordActivityEvent(deps.prisma, {
      projectId: reopened.projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: reopened.id,
      eventType: "run.reopened",
      title: "Test run reopened",
      body: reopened.name
    });
    return reply.send(toJsonSafe(ok(reopened)));
  });

  app.post("/api/runs/:runId/tests", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = addCasesToRunBodySchema.parse(req.body ?? {});
    const out = await deps.runsService.addCasesToOpenRun(runId, body.caseIds);
    const projectId = out.run.projectId;
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: out.run.id,
      eventType: "run.tests_added",
      title: "Tests added to run",
      body: `${out.added.length} instance(s)`,
      payload: {
        runId: out.run.id.toString(),
        caseIds: body.caseIds.map((id) => id.toString()),
        addedTestIds: out.added.map((row) => row.id.toString()),
        addedCaseIds: out.added.map((row) => row.caseId.toString()),
        skipped: out.skipped
      }
    });
    return reply.send(toJsonSafe(ok(out)));
  });

  app.post("/api/runs/:runId/remove-test", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = removeTestFromRunBodySchema.parse(req.body ?? {});
    const projectId = await projectIdForRun(deps.repo, runId);
    if (!projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const out = await deps.runsService.removeTestFromOpenRun(runId, body.testId, body.confirmDataLoss === true);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: runId,
      eventType: "run.test_removed",
      title: "Test removed from run",
      body: out.titleSnapshot,
      payload: {
        runId: runId.toString(),
        testId: body.testId.toString(),
        caseId: out.caseId.toString(),
        hadResults: out.hadResults
      }
    });
    return reply.send(toJsonSafe(ok(out)));
  });

  app.get("/api/runs/:runId/summary", async (req, reply) => {
    const params = runIdParamSchema.parse(req.params);
    const summary = await calculateRunSummary(deps.repo, params.runId);
    return reply.send(toJsonSafe(summary));
  });

  app.post("/api/runs/:runId/rerun", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const { statuses } = rerunSchema.parse(req.body);
    const created = await deps.runsService.rerunByStatuses(runId, statuses);
    await recordActivityEvent(deps.prisma, {
      projectId: created.run.projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: created.run.id,
      eventType: "run.rerun_created",
      title: "Rerun created",
      body: created.run.name,
      payload: { sourceRunId: runId.toString(), statuses }
    });
    return reply.send(toJsonSafe(created));
  });

  app.patch("/api/tests/:testId/assignee", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { testId } = testIdParamSchema.parse(req.params);
    const { assignedTo } = updateTestAssigneeSchema.parse(req.body);
    const updated = await deps.runsService.updateTestAssignee(testId, assignedTo);
    if (deps.prisma) {
      const instance = await deps.prisma.testInstance.findUnique({
        where: { id: testId },
        select: { run: { select: { projectId: true } }, titleSnapshot: true }
      });
      if (instance) {
        await recordActivityEvent(deps.prisma, {
          projectId: instance.run.projectId,
          actorUserId: user.id,
          entityType: "test",
          entityId: testId,
          eventType: "test.assigned",
          title: "Test assignment changed",
          body: instance.titleSnapshot,
          payload: { assignedTo: assignedTo?.toString() ?? null },
          notificationType: "assignment"
        });
      }
    }
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.get("/api/projects/:projectId/tests/assigned-to-me", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const rows = await deps.runsService.listAssignedToMe(projectId, user.id);
    return reply.send(toJsonSafe(ok({ items: rows })));
  });
}
