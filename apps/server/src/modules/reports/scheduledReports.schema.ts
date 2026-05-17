import { z } from "zod";

export const scheduledReportTypeSchema = z.enum([
  "run_summary",
  "milestone_summary",
  "plan_summary",
  "results_explorer",
  "traceability",
  "coverage_gap",
  "defect_coverage",
  "defect_summary",
  "case_activity_summary",
  "cases_property_distribution",
  "status_tops",
  "results_case_comparison",
  "results_property_distribution",
  "refs_coverage",
  "refs_comparison",
  "refs_defect_summary",
  "project_summary",
  "users_workload_summary"
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
