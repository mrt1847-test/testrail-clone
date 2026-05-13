import { z } from "zod";

const customValuesSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]));
const presenceFilterSchema = z.enum(["with", "without"]);
const sectionScopeSchema = z.enum(["direct", "subtree"]);

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
  q: z.string().optional(),
  priority: z.string().optional(),
  caseType: z.string().optional(),
  automation: z.enum(["manual", "automated"]).optional(),
  refs: presenceFilterSchema.optional(),
  labels: presenceFilterSchema.optional(),
  estimate: presenceFilterSchema.optional(),
  sectionScope: sectionScopeSchema.default("subtree"),
  state: z.enum(["active", "archived"]).optional()
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

export const bulkDeleteCasesSchema = z.object({
  caseIds: z.array(z.coerce.bigint()).min(1).max(200)
});

export const bulkMoveCasesSchema = z.object({
  caseIds: z.array(z.coerce.bigint()).min(1).max(200),
  targetSectionId: z.coerce.bigint()
});

export const bulkCopyCasesSchema = z.object({
  caseIds: z.array(z.coerce.bigint()).min(1).max(200),
  targetSectionId: z.coerce.bigint()
});

export const bulkUpdateCasesSchema = z.object({
  caseIds: z.array(z.coerce.bigint()).min(1).max(200),
  patch: z
    .object({
      priority: z.string().optional(),
      caseType: z.string().optional()
    })
    .refine((value) => value.priority !== undefined || value.caseType !== undefined, {
      message: "at least one patch field is required"
    })
});

export const bulkArchiveCasesSchema = z.object({
  caseIds: z.array(z.coerce.bigint()).min(1).max(200),
  archived: z.boolean().default(true)
});

export const reorderCasesSchema = z.object({
  sectionId: z.coerce.bigint(),
  orderedCaseIds: z.array(z.coerce.bigint()).min(1).max(500)
});

export const positionCasesSchema = z
  .object({
    sectionId: z.coerce.bigint(),
    caseIds: z.array(z.coerce.bigint()).min(1).max(200),
    beforeCaseId: z.coerce.bigint().optional(),
    afterCaseId: z.coerce.bigint().optional()
  })
  .refine((value) => !(value.beforeCaseId && value.afterCaseId), {
    message: "provide only one of beforeCaseId or afterCaseId"
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

