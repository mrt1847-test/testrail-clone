import { z } from "zod";

export const scheduledReportTypeSchema = z.enum([
  "run_summary",
  "milestone_summary",
  "plan_summary",
  "results_explorer",
  "traceability",
  "coverage_gap",
  "defect_coverage"
]);

export const scheduledReportIdParamSchema = z.object({
  scheduledReportId: z.coerce.bigint()
});

export const createScheduledReportSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    savedReportId: z.coerce.bigint().optional(),
    reportType: scheduledReportTypeSchema.optional(),
    filters: z
      .object({
        ui: z.record(z.string()).optional(),
        export: z.record(z.unknown()).optional()
      })
      .optional(),
    intervalMinutes: z.coerce.number().int().min(15).max(10_080),
    recipientEmails: z.array(z.string().email()).min(1).max(20),
    enabled: z.boolean().optional().default(true)
  })
  .refine((body) => body.savedReportId != null || body.reportType != null, {
    message: "reportType is required when savedReportId is omitted"
  });

export const updateScheduledReportSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  intervalMinutes: z.coerce.number().int().min(15).max(10_080).optional(),
  recipientEmails: z.array(z.string().email()).min(1).max(20).optional(),
  enabled: z.boolean().optional()
});
