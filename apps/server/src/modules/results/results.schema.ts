import { z } from "zod";

export const resultSchema = z.object({
  status: z.enum(["untested", "passed", "failed", "blocked", "retest"]),
  comment: z.string().optional(),
  elapsed: z.string().optional(),
  version: z.string().optional(),
  defects: z.array(z.string()).optional(),
  source: z.enum(["manual", "automation", "api"]).optional(),
  stepResults: z
    .array(
      z.object({
        stepOrder: z.number().int().positive(),
        status: z.enum(["untested", "passed", "failed", "blocked", "retest"]),
        actualResult: z.string().optional(),
        comment: z.string().optional()
      })
    )
    .optional()
});

export const testIdParamSchema = z.object({ testId: z.coerce.bigint() });
export const byCaseSchema = z.object({ caseId: z.coerce.bigint() }).merge(resultSchema);
export const bulkSchema = z.object({
  atomic: z.boolean().optional(),
  results: z.array(z.object({ caseId: z.coerce.bigint() }).merge(resultSchema))
});
