import { z } from "zod";

export const executionCommentEntityTypeSchema = z.enum(["test_instance", "test_run"]);

export const createExecutionCommentSchema = z.object({
  content: z.string().trim().min(1).max(8000),
  parentId: z.coerce.bigint().optional()
});

export const testIdParamSchema = z.object({
  testId: z.coerce.bigint()
});

export const runIdParamSchema = z.object({
  runId: z.coerce.bigint()
});
