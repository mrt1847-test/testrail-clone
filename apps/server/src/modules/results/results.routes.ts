import type { FastifyInstance } from "fastify";

import type { ResultsService } from "./results.service.js";
import { resultIdParamSchema, resultSchema, testIdParamSchema } from "./results.schema.js";
import { toJsonSafe } from "../../common/utils/serialize.js";

export async function registerResultsRoutes(
  app: FastifyInstance,
  deps: { resultsService: ResultsService }
) {
  app.post("/api/tests/:testId/results", async (req, reply) => {
    const params = testIdParamSchema.parse(req.params);
    const body = resultSchema.parse(req.body);
    const created = await deps.resultsService.addResultToTestInstance(params.testId, body);
    return reply.send(toJsonSafe(created));
  });

  app.get("/api/tests/:testId/results", async (req, reply) => {
    const params = testIdParamSchema.parse(req.params);
    const results = await deps.resultsService.listResultsForTestInstance(params.testId);
    return reply.send(toJsonSafe(results));
  });

  app.get("/api/results/:resultId/steps", async (req, reply) => {
    const params = resultIdParamSchema.parse(req.params);
    const steps = await deps.resultsService.listResultStepsByResultId(params.resultId);
    return reply.send(toJsonSafe(steps));
  });
}
