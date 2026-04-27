import type { FastifyInstance } from "fastify";

import type { ResultsService } from "./results.service.js";
import { resultSchema, testIdParamSchema } from "./results.schema.js";

export async function registerResultsRoutes(
  app: FastifyInstance,
  deps: { resultsService: ResultsService }
) {
  app.post("/api/tests/:testId/results", async (req, reply) => {
    const params = testIdParamSchema.parse(req.params);
    const body = resultSchema.parse(req.body);
    const created = await deps.resultsService.addResultToTestInstance(params.testId, body);
    return reply.send(created);
  });
}
