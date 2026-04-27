import { z } from "zod";

export const createRunSchema = z.object({
  projectId: z.coerce.bigint(),
  suiteId: z.coerce.bigint(),
  name: z.string().min(1),
  includeAll: z.boolean().default(true),
  caseIds: z.array(z.coerce.bigint()).optional()
});

export const runIdParamSchema = z.object({
  runId: z.coerce.bigint()
});
