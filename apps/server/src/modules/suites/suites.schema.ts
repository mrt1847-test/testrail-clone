import { z } from "zod";

export const createSuiteSchema = z.object({
  projectId: z.coerce.bigint(),
  name: z.string().min(1),
  description: z.string().optional()
});

export const projectIdParamSchema = z.object({
  projectId: z.coerce.bigint()
});

export const suiteIdParamSchema = z.object({
  suiteId: z.coerce.bigint()
});

export const updateSuiteSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional()
});
