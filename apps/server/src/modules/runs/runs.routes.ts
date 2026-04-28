import type { FastifyInstance } from "fastify";

import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { AppError } from "../../common/errors/appError.js";
import type { AuthService } from "../auth/auth.service.js";
import type { PrismaClient } from "@prisma/client";
import type { ResultsService } from "../results/results.service.js";
import { byCaseSchema, bulkSchema, runResultSchema } from "../results/results.schema.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { RunsService } from "./runs.service.js";
import { createProjectRunSchema, rerunSchema, runIdParamSchema, updateRunSchema } from "./runs.schema.js";
import { calculateRunSummary } from "../reports/reports.service.js";
import type { RunsRepository } from "./runs.repository.js";

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
    const run = await deps.repo.getRun(runId);
    if (!run || run.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const instances = await deps.repo.listInstancesForRun(runId);
    return reply.send(toJsonSafe(ok({ run, instances })));
  });

  app.get("/api/projects/:projectId/runs/:runId/instances", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    const run = await deps.repo.getRun(runId);
    if (!run || run.projectId !== projectId) {
      throw new AppError("NOT_FOUND", "run not found", 404);
    }
    const instances = await deps.repo.listInstancesForRun(runId);
    return reply.send(toJsonSafe(paged(instances, 1, instances.length || 1)));
  });

  app.post("/api/projects/:projectId/runs", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const raw = createProjectRunSchema.parse(req.body);
    const body = { ...raw, projectId };
    const created = await deps.runsService.createRunWithInstances(body);
    return reply.send(toJsonSafe(created));
  });

  app.patch("/api/runs/:runId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = updateRunSchema.parse(req.body);
    const updated = await deps.runsService.updateRun(runId, body);
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.post("/api/runs/:runId/results/by-case", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const params = runIdParamSchema.parse(req.params);
    const body = byCaseSchema.parse(req.body);
    const created = await deps.resultsService.addResultForCaseInRun(params.runId, body.caseId, body);
    return reply.send(toJsonSafe(created));
  });

  app.post("/api/runs/:runId/results/bulk", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const params = runIdParamSchema.parse(req.params);
    const body = bulkSchema.parse(req.body);
    const res = await deps.resultsService.bulkAddResults({
      runId: params.runId,
      atomic: body.atomic,
      results: body.results.map((item) => ({
        ...item,
        caseId: item.caseId as bigint
      }))
    });
    return reply.send(toJsonSafe(res));
  });

  app.post("/api/runs/:runId/results", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const body = runResultSchema.parse(req.body);
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
      return reply.send(toJsonSafe(created));
    }
    if (!body.caseId) {
      throw new AppError("VALIDATION_ERROR", "caseId is required", 400);
    }
    const created = await deps.resultsService.addResultForCaseInRun(runId, body.caseId, body);
    return reply.send(toJsonSafe(created));
  });

  app.post("/api/runs/:runId/close", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const closed = await deps.runsService.closeRun(runId);
    return reply.send(toJsonSafe(ok(closed)));
  });

  app.get("/api/runs/:runId/summary", async (req, reply) => {
    const params = runIdParamSchema.parse(req.params);
    const summary = await calculateRunSummary(deps.repo, params.runId);
    return reply.send(toJsonSafe(summary));
  });

  app.post("/api/runs/:runId/rerun", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const { runId } = runIdParamSchema.parse(req.params);
    const { statuses } = rerunSchema.parse(req.body);
    const created = await deps.runsService.rerunByStatuses(runId, statuses);
    return reply.send(toJsonSafe(created));
  });
}
