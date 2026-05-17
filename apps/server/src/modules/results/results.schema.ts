import { z } from "zod";

const normalizeResultAlias = (value: unknown) => {
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  return {
    ...row,
    caseId: row.caseId ?? row.case_id,
    testId: row.testId ?? row.test_id
  };
};

export const resultSchema = z.object({
  status: z.enum(["untested", "passed", "failed", "blocked", "retest"]),
  comment: z.string().optional(),
  elapsed: z.string().optional(),
  version: z.string().optional(),
  defects: z.array(z.string()).optional(),
  aiActualOutput: z.string().nullable().optional(),
  aiQualityRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  aiLatencyMs: z.coerce.number().int().min(0).nullable().optional(),
  aiTraces: z.string().nullable().optional(),
  customValues: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])).optional(),
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
    .optional(),
  scenarioResults: z
    .array(
      z.object({
        caseScenarioId: z.coerce.bigint(),
        status: z.enum(["untested", "passed", "failed", "blocked", "retest"]),
        comment: z.string().optional()
      })
    )
    .optional()
});

export const testIdParamSchema = z.object({ testId: z.coerce.bigint() });
export const resultIdParamSchema = z.object({ resultId: z.coerce.bigint() });
export const byCaseSchema = z.preprocess(
  normalizeResultAlias,
  z.object({ caseId: z.coerce.bigint() }).merge(resultSchema)
);
export const runResultSchema = z.preprocess(
  normalizeResultAlias,
  z
    .object({
      caseId: z.coerce.bigint().optional(),
      testId: z.coerce.bigint().optional()
    })
    .merge(resultSchema)
    .refine((value) => Boolean(value.caseId || value.testId), {
      message: "either caseId or testId is required"
    })
);
export const bulkSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object") return value;
    const row = value as { results?: unknown[]; atomic?: boolean };
    return {
      ...row,
      results: (row.results ?? []).map((item) => normalizeResultAlias(item))
    };
  },
  z.object({
    atomic: z.boolean().optional(),
    results: z
      .array(z.object({ caseId: z.coerce.bigint().optional() }).merge(resultSchema))
      .refine((items) => items.every((item) => item.caseId !== undefined), {
        message: "caseId is required"
      })
  })
);
