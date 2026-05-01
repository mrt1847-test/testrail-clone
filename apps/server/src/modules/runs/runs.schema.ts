import { z } from "zod";

export const createRunSchema = z.object({
  projectId: z.coerce.bigint(),
  suiteId: z.coerce.bigint(),
  milestoneId: z.coerce.bigint().nullable().optional(),
  name: z.string().min(1),
  environment: z.string().trim().min(1).max(120).optional(),
  includeAll: z.boolean().default(true),
  caseIds: z.array(z.coerce.bigint()).optional(),
  excludedCaseIds: z.array(z.coerce.bigint()).optional()
});

export const createProjectRunSchema = createRunSchema.omit({ projectId: true });

export const updateRunSchema = z.object({
  name: z.string().min(1).optional(),
  assignedTo: z.coerce.bigint().nullable().optional()
});

export const rerunSchema = z.object({
  statuses: z.array(z.enum(["passed", "failed", "blocked", "retest", "untested"])).min(1).default(["failed"])
});

export const runIdParamSchema = z.object({
  runId: z.coerce.bigint()
});

export const testIdParamSchema = z.object({
  testId: z.coerce.bigint()
});

export const updateTestAssigneeSchema = z.object({
  assignedTo: z.coerce.bigint().nullable()
});

export const runInstancesQuerySchema = z.object({
  status: z.enum(["passed", "failed", "blocked", "retest", "untested"]).optional(),
  assignedTo: z
    .preprocess((value) => {
      if (value === "" || value === "null") return null;
      return value;
    }, z.coerce.bigint().nullable())
    .optional(),
  q: z.string().trim().min(1).optional(),
  includeInstances: z.coerce.boolean().optional()
});
