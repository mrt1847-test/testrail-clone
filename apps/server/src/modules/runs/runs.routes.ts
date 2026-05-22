import { z } from "zod";
import type { FastifyInstance } from "fastify";

import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import {
  getAuthenticatedUser,
  requireProjectMutationRole,
  requireProjectPermission,
  requireProjectPermissionForProject
} from "../../common/middlewares/authorization.js";
import { AppError } from "../../common/errors/appError.js";
import { validateRunSuiteBinding } from "../../domain/runSuitePolicy.js";
import type { AuthService } from "../auth/auth.service.js";
import type { PrismaClient } from "@prisma/client";
import type { ResultsService } from "../results/results.service.js";
import { byCaseSchema, bulkSchema, runResultSchema } from "../results/results.schema.js";
import { resultCustomFieldErrorResponse, validateResultCustomValues } from "../results/resultCustomValues.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import { caseIdParamSchema } from "../cases/cases.schema.js";
import { listCaseExecutionHistory } from "./caseExecutionHistory.service.js";
import { buildRunInstancesCsv } from "../../domain/runInstancesCsv.js";
import type { RunsService } from "./runs.service.js";
import {
  addCasesToRunBodySchema,
  createProjectRunSchema,
  removeTestFromRunBodySchema,
  duplicateRunSchema,
  rerunSchema,
  runInstancesQuerySchema,
  runInstancesGroupedQuerySchema,
  caseExecutionHistoryQuerySchema,
  runIdParamSchema,
  testIdParamSchema,
  updateRunCompositionSchema,
  updateRunSchema,
  updateTestAssigneeSchema,
  teamTodoQuerySchema,
  assignmentListQuerySchema
} from "./runs.schema.js";
import type { AssignmentListFilters } from "./assignmentListFilters.js";
import { runProgressMetricsToApi } from "../../domain/runProgress.js";
import { calculateRunSummary } from "../reports/reports.service.js";
import { loadRunProgressMetrics } from "./runProgressMetrics.js";
import type { RunsRepository } from "./runs.repository.js";
import { recordActivityEvent, recordResultActivity } from "../activity/activity.service.js";
import {
  recordBulkResultsActivity,
  recordRunAssignmentActivity,
  recordTestAssignmentActivity
} from "../activity/activityRecording.js";
import {
  listSubscribedTestIdsForRun,
  setTestSubscription
} from "../subscriptions/testSubscriptions.service.js";
import { recordAuditLog } from "../settings/auditLog.service.js";
import { inheritRunDatesFromMilestone } from "../../domain/runDates.js";
import { runDateWarningsForRun } from "./runSchedule.js";
import { buildRunsOverview } from "./runsOverview.service.js";
import { runsOverviewQuerySchema } from "./runsOverview.schema.js";

const testSubscriptionBodySchema = z.object({
  subscribed: z.boolean()
});

async function resolveAssignmentListFilters(
  prisma: PrismaClient | undefined,
  projectId: bigint,
  query: z.infer<typeof assignmentListQuerySchema>
): Promise<AssignmentListFilters> {
  if (query.milestoneId && query.milestoneId !== "none" && prisma) {
    const milestone = await prisma.milestone.findFirst({
      where: { id: query.milestoneId, projectId, deletedAt: null },
      select: { id: true }
    });
    if (!milestone) {
      throw new AppError("VALIDATION_ERROR", "milestone not found in project", 400);
    }
  }
  return {
    status: query.status,
    runId: query.runId,
    q: query.q,
    milestoneId: query.milestoneId,
    dueBefore: query.dueBefore,
    dueAfter: query.dueAfter,
    overdue: query.overdue,
    dueUnset: query.dueUnset
  };
}

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
  app.get("/api/projects/:projectId/runs-overview", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = runsOverviewQuerySchema.parse(req.query ?? {});
    const overview = await buildRunsOverview(projectId, deps, {
      mine: query.mine,
      userId: user.id,
      milestoneId: query.milestoneId,
      orderBy: query.orderBy,
      openLimit: query.openLimit,
      completedLimit: query.completedLimit
    });
    return reply.send(toJsonSafe(ok(overview)));
  });

  app.get("/api/projects/:projectId/runs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const runs = await deps.repo.listRunsByProject(projectId);
    const items = await Promise.all(
      runs.map(async (run) => {
        const metrics = await loadRunProgressMetrics(deps.repo, run.id);
        const progress = runProgressMetricsToApi(metrics);
        return {
          ...run,
          progress: progress.progressPercent,
          failed: metrics.failed,
          metrics: progress
        };
      })
    );
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
    const metrics = await loadRunProgressMetrics(deps.repo, runId);
    const progress = runProgressMetricsToApi(metrics);
    const dateWarnings = await runDateWarningsForRun(deps.prisma, run);
    return reply.send(
      toJsonSafe(
        ok({
          run: { ...run, progress: progress.progressPercent, failed: metrics.failed },
          instances,
          dateWarnings,
          metrics: progress
        })
      )
    );
  });

  app.get("/api/projects/:projectId/runs/:runId/instances", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const listQuery = runInstancesQuerySchema.parse(req.query ?? {});
    const run = await deps.repo.getRun(runId);
    if (!run || run.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const { status, assignedTo, q, priority, caseType, caseChanged, sortBy, sortDir } = listQuery;
    const { items, total } = await deps.repo.listInstancesForRunPage({
      runId,
      page,
      pageSize,
      status,
      assignedTo,
      q,
      priority,
      caseType,
      caseChanged,
      sortBy,
      sortDir
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

  app.get("/api/projects/:projectId/runs/:runId/instances/grouped", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    const query = runInstancesGroupedQuerySchema.parse(req.query ?? {});
    const run = await deps.repo.getRun(runId);
    if (!run || run.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const { groupBy, sectionId, status, assignedTo, q, priority, caseType, caseChanged, sortBy, sortDir } = query;
    const grouped = await deps.repo.listInstancesForRunGrouped({
      runId,
      suiteId: run.suiteId,
      groupBy,
      sectionId,
      status,
      assignedTo,
      q,
      priority,
      caseType,
      caseChanged,
      sortBy,
      sortDir
    });
    return reply.send(
      toJsonSafe({
        groupBy: query.groupBy,
        suiteId: run.suiteId.toString(),
        total: grouped.total,
        truncated: grouped.truncated,
        sectionCounts: grouped.sectionCounts,
        groups: grouped.groups.map((group) => ({
          groupKey: group.groupKey,
          groupLabel: group.groupLabel,
          sectionId: group.sectionId?.toString() ?? null,
          sectionName: group.sectionName,
          displayOrder: group.displayOrder,
          parentSectionId: group.parentSectionId?.toString() ?? null,
          instances: group.cases
        }))
      })
    );
  });

  app.get("/api/projects/:projectId/cases/:caseId/execution-history", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { caseId } = caseIdParamSchema.parse(req.params);
    const { limit } = caseExecutionHistoryQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) {
      throw new AppError("NOT_IMPLEMENTED", "execution history requires prisma mode", 501);
    }
    await requireProjectPermissionForProject(req, deps, projectId, "cases.read");
    const items = await listCaseExecutionHistory(deps.prisma, projectId, caseId, limit);
    return reply.send(
      toJsonSafe({
        caseId: caseId.toString(),
        total: items.length,
        items: items.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString()
        }))
      })
    );
  });

  app.get("/api/projects/:projectId/runs/:runId/instances/export/csv", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    await requireProjectPermissionForProject(req, deps, projectId, "runs.read");
    const run = await deps.repo.getRun(runId);
    if (!run || run.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const instances = await deps.repo.listInstancesForRun(runId);
    const csv = buildRunInstancesCsv(instances);
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="run-${runId.toString()}-tests.csv"`);
    return reply.send(csv);
  });

  app.post("/api/projects/:projectId/runs", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const raw = createProjectRunSchema.parse(req.body);
    let startedAt = raw.startedAt ?? null;
    let dueOn = raw.dueOn ?? null;
    if (deps.prisma && raw.milestoneId) {
      const milestone = await deps.prisma.milestone.findFirst({
        where: { id: raw.milestoneId, projectId, deletedAt: null },
        select: { startDate: true, dueDate: true }
      });
      const inherited = inheritRunDatesFromMilestone(
        { startedAt: raw.startedAt, dueOn: raw.dueOn },
        milestone ? { startDate: milestone.startDate, dueDate: milestone.dueDate } : null
      );
      startedAt = inherited.startedAt;
      dueOn = inherited.dueOn;
    }
    const body = { ...raw, projectId, startedAt, dueOn };
    if (deps.prisma) {
      await validateRunSuiteBinding(deps.prisma, {
        projectId,
        suiteId: body.suiteId,
        caseIds: body.caseIds
      });
    }
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
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = updateRunSchema.parse(req.body);
    const updated = await deps.runsService.updateRun(runId, body);
    if (!updated) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const hasPatch =
      body.name !== undefined ||
      body.assignedTo !== undefined ||
      body.startedAt !== undefined ||
      body.dueOn !== undefined ||
      body.closedAt !== undefined;
    if (hasPatch) {
      await recordAuditLog(deps.prisma, {
        projectId: updated.projectId,
        actorUserId: user.id,
        action: body.assignedTo !== undefined ? "run.assignment.updated" : "run.updated",
        entityType: "run",
        entityId: updated.id,
        changes: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo?.toString() ?? null } : {}),
          ...(body.startedAt !== undefined ? { startedAt: body.startedAt?.toISOString() ?? null } : {}),
          ...(body.dueOn !== undefined ? { dueOn: body.dueOn?.toISOString() ?? null } : {}),
          ...(body.closedAt !== undefined ? { closedAt: body.closedAt?.toISOString() ?? null } : {})
        }
      });
      if (body.assignedTo !== undefined) {
        await recordRunAssignmentActivity(deps.prisma, {
          projectId: updated.projectId,
          runId: updated.id,
          actorUserId: user.id,
          runName: updated.name,
          assignedTo: updated.assignedTo,
          extraPayload: body.name !== undefined ? { name: body.name } : {}
        });
      } else {
        await recordActivityEvent(deps.prisma, {
          projectId: updated.projectId,
          actorUserId: user.id,
          entityType: "run",
          entityId: updated.id,
          eventType: "run.updated",
          title: "Test run updated",
          body: updated.name,
          payload: {
            runId: updated.id.toString(),
            ...(body.name !== undefined ? { name: body.name } : {})
          }
        });
      }
    }
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.patch("/api/runs/:runId/assignee", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = updateRunSchema.parse(req.body);
    const updated = await deps.runsService.updateRun(runId, { assignedTo: body.assignedTo ?? null });
    await recordAuditLog(deps.prisma, {
      projectId: updated.projectId,
      actorUserId: user.id,
      action: "run.assignment.updated",
      entityType: "run",
      entityId: updated.id,
      changes: { assignedTo: updated.assignedTo?.toString() ?? null }
    });
    await recordRunAssignmentActivity(deps.prisma, {
      projectId: updated.projectId,
      runId: updated.id,
      actorUserId: user.id,
      runName: updated.name,
      assignedTo: updated.assignedTo
    });
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.post("/api/runs/:runId/results/by-case", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
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
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
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
    if (projectId) {
      await recordBulkResultsActivity(deps.prisma, {
        projectId,
        runId: params.runId,
        actorUserId: user.id,
        res
      });
    }
    return reply.send(toJsonSafe(res));
  });

  app.post("/api/runs/:runId/results", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
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
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
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

  app.post("/api/projects/:projectId/runs/:runId/sync-composition", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    const run = await deps.repo.getRun(runId);
    if (!run || run.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const result = await deps.runsService.syncRunComposition(runId);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: runId,
      eventType: "run.composition_synced",
      title: "Run composition synced",
      body: `+${result.added} / -${result.removed}`,
      payload: {
        runId: runId.toString(),
        skipped: result.skipped,
        added: result.added,
        removed: result.removed,
        reason: result.reason ?? null
      }
    });
    return reply.send(toJsonSafe(ok(result)));
  });

  app.patch("/api/projects/:projectId/runs/:runId/composition", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = updateRunCompositionSchema.parse(req.body ?? {});
    const run = await deps.repo.getRun(runId);
    if (!run || run.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const result = await deps.runsService.updateRunComposition(runId, body);
    await recordActivityEvent(deps.prisma, {
      projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: runId,
      eventType: "run.composition_updated",
      title: "Run composition updated",
      body: result.run.name,
      payload: {
        runId: runId.toString(),
        compositionMode: result.run.composition?.compositionMode ?? "static",
        filterSelectionMode: body.filterSelectionMode ?? null,
        synced: result.sync != null && !result.sync.skipped
      }
    });
    return reply.send(toJsonSafe(ok(result)));
  });

  app.post("/api/runs/:runId/reopen", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
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
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = addCasesToRunBodySchema.parse(req.body ?? {});
    const run = await deps.repo.getRun(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    if (deps.prisma) {
      await validateRunSuiteBinding(deps.prisma, {
        projectId: run.projectId,
        suiteId: run.suiteId,
        caseIds: body.caseIds
      });
    }
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
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
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
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
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

  app.post("/api/runs/:runId/duplicate", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: "runs.write" });
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = duplicateRunSchema.parse(req.body ?? {});
    const created = await deps.runsService.duplicateRun(runId, body);
    await recordActivityEvent(deps.prisma, {
      projectId: created.run.projectId,
      actorUserId: user.id,
      entityType: "run",
      entityId: created.run.id,
      eventType: "run.duplicated",
      title: "Run duplicated",
      body: created.run.name,
      payload: {
        sourceRunId: runId.toString(),
        copyAssignee: body.copyAssignee,
        copySchedule: body.copySchedule,
        copyEnvironment: body.copyEnvironment
      }
    });
    return reply.send(toJsonSafe(created));
  });

  app.patch("/api/tests/:testId/assignee", async (req, reply) => {
    await requireProjectMutationRole(req, deps, { permission: 'runs.write' });
    const user = await getAuthenticatedUser(req, deps);
    const { testId } = testIdParamSchema.parse(req.params);
    const { assignedTo } = updateTestAssigneeSchema.parse(req.body);
    const updated = await deps.runsService.updateTestAssignee(testId, assignedTo);
    if (deps.prisma) {
      const instance = await deps.prisma.testInstance.findUnique({
        where: { id: testId },
        select: { caseId: true, run: { select: { id: true, projectId: true, name: true } }, titleSnapshot: true }
      });
      if (instance) {
        await recordAuditLog(deps.prisma, {
          projectId: instance.run.projectId,
          actorUserId: user.id,
          action: "test.assignment.updated",
          entityType: "test",
          entityId: testId,
          changes: {
            runId: instance.run.id.toString(),
            caseId: instance.caseId.toString(),
            assignedTo: assignedTo?.toString() ?? null
          }
        });
        await recordTestAssignmentActivity(deps.prisma, {
          projectId: instance.run.projectId,
          testId,
          actorUserId: user.id,
          assignedTo,
          titleSnapshot: instance.titleSnapshot,
          runId: instance.run.id,
          runName: instance.run.name,
          caseId: instance.caseId
        });
      }
    }
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.get("/api/projects/:projectId/tests/assigned-to-me", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const user = await getAuthenticatedUser(req, deps);
    const query = assignmentListQuerySchema.parse(req.query ?? {});
    const filters = await resolveAssignmentListFilters(deps.prisma, projectId, query);
    const rows = await deps.runsService.listAssignedToMe(projectId, user.id, filters);
    return reply.send(toJsonSafe(ok({ items: rows })));
  });

  app.get("/api/projects/:projectId/tests/team-todo", async (req, reply) => {
    await requireProjectPermission(req, deps, "runs.read");
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = teamTodoQuerySchema.parse(req.query ?? {});

    if (query.assigneeId !== "all" && deps.prisma) {
      const member = await deps.prisma.projectMember.findFirst({
        where: { projectId, userId: query.assigneeId, deletedAt: null },
        select: { id: true }
      });
      if (!member) {
        throw new AppError("VALIDATION_ERROR", "assignee is not a project member", 400);
      }
    }

    const filters = await resolveAssignmentListFilters(deps.prisma, projectId, query);
    const rows = await deps.runsService.listTeamTodo(projectId, {
      assigneeId: query.assigneeId,
      ...filters
    });
    return reply.send(toJsonSafe(ok({ items: rows })));
  });

  app.get("/api/runs/:runId/test-subscriptions", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    if (!deps.prisma) {
      return reply.send(toJsonSafe(ok({ testIds: [] as string[] })));
    }
    const testIds = await listSubscribedTestIdsForRun(deps.prisma, { runId, userId: user.id });
    return reply.send(toJsonSafe(ok({ testIds: testIds.map((id) => id.toString()) })));
  });

  app.put("/api/tests/:testId/subscription", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { testId } = testIdParamSchema.parse(req.params);
    const body = testSubscriptionBodySchema.parse(req.body ?? {});
    if (!deps.prisma) {
      return reply.code(501).send({ code: "NOT_AVAILABLE", message: "subscriptions require database mode" });
    }
    const instance = await deps.prisma.testInstance.findFirst({
      where: { id: testId, deletedAt: null },
      select: { run: { select: { projectId: true } } }
    });
    if (!instance) return reply.code(404).send({ code: "NOT_FOUND", message: "test not found" });
    try {
      const result = await setTestSubscription(deps.prisma, {
        projectId: instance.run.projectId,
        userId: user.id,
        testId,
        subscribed: body.subscribed
      });
      return reply.send(
        toJsonSafe(
          ok({
            testId: result.testId.toString(),
            subscribed: result.subscribed
          })
        )
      );
    } catch (e) {
      if (e instanceof Error && e.message === "TEST_NOT_FOUND") {
        return reply.code(404).send({ code: "NOT_FOUND", message: "test not found" });
      }
      throw e;
    }
  });
}

