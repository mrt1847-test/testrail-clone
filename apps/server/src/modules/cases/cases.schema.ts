import { z } from "zod";

const customValuesSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const createCaseSchema = z.object({
  sectionId: z.coerce.bigint(),
  title: z.string().min(1),
  priority: z.string().optional(),
  caseType: z.string().optional(),
  preconditions: z.string().optional(),
  customValues: customValuesSchema.optional()
});

export const caseIdParamSchema = z.object({
  caseId: z.coerce.bigint()
});

export const caseVersionIdParamSchema = z.object({
  caseId: z.coerce.bigint(),
  versionId: z.coerce.bigint()
});

export const restoreCaseVersionSchema = z.object({
  expectedVersion: z.coerce.number().int().positive().optional()
});

export const projectIdParamSchema = z.object({
  projectId: z.coerce.bigint()
});

export const sectionIdParamSchema = z.object({
  sectionId: z.coerce.bigint()
});

export const listCasesQuerySchema = z.object({
  projectId: z.coerce.bigint().optional(),
  suiteId: z.coerce.bigint().optional(),
  sectionId: z.coerce.bigint().optional(),
  q: z.string().optional()
});

export const updateCaseSchema = z.object({
  title: z.string().min(1).optional(),
  priority: z.string().optional(),
  caseType: z.string().optional(),
  preconditions: z.string().nullable().optional(),
  customValues: customValuesSchema.optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
  expectedVersion: z.coerce.number().int().positive().optional()
});

export const stepIdParamSchema = z.object({
  stepId: z.coerce.bigint()
});

export const createCaseStepSchema = z.object({
  content: z.string().min(1),
  expectedResult: z.string().nullable().optional()
});

export const updateCaseStepSchema = z.object({
  content: z.string().min(1).optional(),
  expectedResult: z.string().nullable().optional(),
  stepOrder: z.coerce.number().int().positive().optional()
});

