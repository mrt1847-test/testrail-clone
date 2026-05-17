import { z } from "zod";

import { compositionModeSchema, runCaseFilterSchema } from "./runComposition.js";

export const createRunSchema = z.object({
  projectId: z.coerce.bigint(),
  suiteId: z.coerce.bigint(),
  milestoneId: z.coerce.bigint().nullable().optional(),
  name: z.string().min(1),
  environment: z.string().trim().min(1).max(120).optional(),
  includeAll: z.boolean().default(true),
  caseIds: z.array(z.coerce.bigint()).optional(),
  excludedCaseIds: z.array(z.coerce.bigint()).optional(),
  /** 섹션 루트 ID(하위 섹션 포함). includeAll이면 스위트 내 해당 트리만, false면 caseIds와 교집합 */
  includedSectionIds: z.array(z.coerce.bigint()).optional(),
  /** includeAll일 때 제외할 섹션 서브트리 루트 */
  excludedSectionIds: z.array(z.coerce.bigint()).optional(),
  compositionMode: compositionModeSchema.optional(),
  filterDefinition: runCaseFilterSchema.optional(),
  startedAt: z.coerce.date().nullable().optional(),
  dueOn: z.coerce.date().nullable().optional()
});

export const createProjectRunSchema = createRunSchema.omit({ projectId: true });

export const updateRunSchema = z.object({
  name: z.string().min(1).optional(),
  assignedTo: z.coerce.bigint().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  dueOn: z.coerce.date().nullable().optional(),
  closedAt: z.coerce.date().nullable().optional()
});

export const filterSelectionModeSchema = z.enum(["set", "add", "remove"]);

export const updateRunCompositionSchema = z.object({
  filterDefinition: runCaseFilterSchema.optional(),
  filterSelectionMode: filterSelectionModeSchema.optional(),
  excludedCaseIds: z.array(z.coerce.bigint()).optional(),
  includedSectionIds: z.array(z.coerce.bigint()).optional(),
  excludedSectionIds: z.array(z.coerce.bigint()).optional(),
  sync: z.boolean().optional().default(true)
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

const milestoneIdFilterSchema = z
  .preprocess((value) => {
    if (value === undefined || value === "" || value === "all") return undefined;
    if (value === "none" || value === "null") return "none";
    return value;
  }, z.union([z.literal("none"), z.coerce.bigint()]))
  .optional();

export const assignmentListQuerySchema = z.object({
  status: z.enum(["passed", "failed", "blocked", "retest", "untested"]).optional(),
  runId: z.coerce.bigint().optional(),
  q: z.string().trim().min(1).optional(),
  milestoneId: milestoneIdFilterSchema,
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  overdue: z.coerce.boolean().optional(),
  dueUnset: z.coerce.boolean().optional()
});

export const teamTodoQuerySchema = assignmentListQuerySchema.extend({
  assigneeId: z
    .preprocess((value) => {
      if (value === undefined || value === "" || value === "all") return "all";
      return value;
    }, z.union([z.literal("all"), z.coerce.bigint()]))
    .optional()
    .default("all")
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
  includeInstances: z
    .preprocess((value) => {
      if (value === "false" || value === "0") return false;
      if (value === "true" || value === "1") return true;
      return value;
    }, z.boolean().optional())
    .optional()
});

export const addCasesToRunBodySchema = z.object({
  caseIds: z.array(z.coerce.bigint()).min(1)
});

export const removeTestFromRunBodySchema = z.object({
  testId: z.coerce.bigint(),
  /** 결과가 있는 인스턴스 제거 시 true여야 함(결과 행은 DB CASCADE로 함께 삭제됨) */
  confirmDataLoss: z.boolean().optional()
});
