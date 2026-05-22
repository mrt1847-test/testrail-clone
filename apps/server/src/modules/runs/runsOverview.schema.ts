import { z } from "zod";

export const runsOverviewQuerySchema = z.object({
  mine: z
    .union([z.literal("1"), z.literal("true"), z.literal(true)])
    .optional()
    .transform((v) => v === "1" || v === "true" || v === true),
  milestoneId: z.string().trim().optional(),
  orderBy: z.enum(["date", "name"]).optional().default("date"),
  openLimit: z.coerce.number().int().positive().max(100).optional(),
  completedLimit: z.coerce.number().int().positive().max(100).optional()
});
