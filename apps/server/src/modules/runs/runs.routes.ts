import type { FastifyInstance } from "fastify";

import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { ResultsService } from "../results/results.service.js";
import { byCaseSchema, bulkSchema } from "../results/results.schema.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import type { RunsService } from "./runs.service.js";
import { createRunSchema, runIdParamSchema } from "./runs.schema.js";
import { calculateRunSummary } from "../reports/reports.service.js";
import type { RunsRepository } from "./runs.repository.js";

export async function registerRunsRoutes(
  app: FastifyInstance,
  deps: { runsService: RunsService; resultsService: ResultsService; repo: RunsRepository }
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
      return reply.status(404).send({ error: "NOT_FOUND", message: "run not found" });
    }
    const instances = await deps.repo.listInstancesForRun(runId);
    return reply.send(toJsonSafe(ok({ run, instances })));
  });

  app.post("/api/runs", async (req, reply) => {
    const body = createRunSchema.parse(req.body);
    const created = await deps.runsService.createRunWithInstances(body);
    return reply.send(toJsonSafe(created));
  });

  app.post("/api/runs/:runId/results/by-case", async (req, reply) => {
    const params = runIdParamSchema.parse(req.params);
    const body = byCaseSchema.parse(req.body);
    const created = await deps.resultsService.addResultForCaseInRun(params.runId, body.caseId, body);
    return reply.send(created);
  });

  app.post("/api/runs/:runId/results/bulk", async (req, reply) => {
    const params = runIdParamSchema.parse(req.params);
    const body = bulkSchema.parse(req.body);
    const res = await deps.resultsService.bulkAddResults({ runId: params.runId, ...body });
    return reply.send(res);
  });

  app.get("/api/runs/:runId/summary", async (req, reply) => {
    const params = runIdParamSchema.parse(req.params);
    const summary = await calculateRunSummary(deps.repo, params.runId);
    return reply.send(summary);
  });
}
