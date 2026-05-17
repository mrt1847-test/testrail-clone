import { z } from "zod";

export const milestoneIdParamSchema = z.object({
  milestoneId: z.coerce.bigint()
});

export const createMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  parentMilestoneId: z.coerce.bigint().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional()
});

export const updateMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  isCompleted: z.boolean().optional(),
  parentMilestoneId: z.coerce.bigint().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startNow: z.boolean().optional()
});
