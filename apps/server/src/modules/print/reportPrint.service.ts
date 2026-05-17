import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import type { PrintDocument } from "../../domain/printDocument.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import { caseActivitySummaryQuerySchema, buildCaseActivitySummaryReport } from "../reports/caseActivitySummary.service.js";
import {
  buildCasePropertyDistributionReport,
  buildCaseStatusTopsReport,
  casePropertyDistributionQuerySchema
} from "../reports/casePropertyReports.service.js";
import { buildDefectSummaryReportForProject, defectSummaryQuerySchema } from "../reports/defectSummary.service.js";
import { buildMilestoneSummary } from "../reports/milestoneSummary.service.js";
import { buildPlanSummaryItems } from "../reports/reports.routes.js";
import {
  buildProjectExecutionSummaryForProject,
  buildUserWorkloadSummaryForProject
} from "../reports/projectSummaryReports.service.js";
import {
  buildResultsCaseComparisonReport,
  buildResultsPropertyDistributionReport,
  resultsCaseComparisonQuerySchema,
  resultsPropertyDistributionQuerySchema
} from "../reports/resultReports.service.js";
import {
  buildRefsComparisonReportForProject,
  buildRefsCoverageReportForProject,
  buildRefsDefectSummaryReportForProject,
  refsComparisonQuerySchema
} from "../reports/refsReports.service.js";
import type { RunsRepository } from "../runs/runs.repository.js";

export const reportPrintTypeSchema = z.enum([
  "project_summary",
  "users_workload_summary",
  "milestone_summary",
  "plan_summary",
  "case_activity_summary",
  "cases_property_distribution",
  "status_tops",
  "defect_summary",
  "results_case_comparison",
  "results_property_distribution",
  "refs_coverage",
  "refs_comparison",
  "refs_defect_summary"
]);

export type ReportPrintType = z.infer<typeof reportPrintTypeSchema>;

export const reportPrintQuerySchema = z
  .object({
    reportType: reportPrintTypeSchema,
    days: z.coerce.number().int().min(1).max(365).optional(),
    actorUserId: z.coerce.bigint().optional(),
    category: z.enum(["created", "updated", "deleted", "other", "all"]).optional(),
    field: z.string().optional(),
    milestoneId: z.coerce.bigint().optional(),
    planId: z.coerce.bigint().optional(),
    runId: z.coerce.bigint().optional(),
    runIdA: z.coerce.bigint().optional(),
    runIdB: z.coerce.bigint().optional(),
    property: z.string().optional(),
    status: z.string().optional()
  })
  .passthrough();

type ReportPrintDeps = {
  prisma?: PrismaClient;
  repo: RunsRepository;
  catalog?: ProjectsRepository;
};

function isoNow() {
  return new Date().toISOString();
}

async function projectLabel(prisma: PrismaClient | undefined, projectId: bigint) {
  if (!prisma) return `Project ${projectId.toString()}`;
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { name: true }
  });
  return row?.name ?? `Project ${projectId.toString()}`;
}

async function docBase(
  projectId: bigint,
  deps: ReportPrintDeps,
  title: string,
  meta: PrintDocument["meta"],
  tables: PrintDocument["tables"],
  notes?: string[]
): Promise<PrintDocument> {
  return {
    entityType: "report",
    title,
    subtitle: await projectLabel(deps.prisma, projectId),
    generatedAt: isoNow(),
    meta,
    tables,
    notes
  };
}

export async function buildReportPrintDocument(
  projectId: bigint,
  input: z.infer<typeof reportPrintQuerySchema>,
  deps: ReportPrintDeps
): Promise<PrintDocument> {
  const reportDeps = { prisma: deps.prisma, repo: deps.repo, catalog: deps.catalog };

  switch (input.reportType) {
    case "project_summary": {
      const report = await buildProjectExecutionSummaryForProject(projectId, reportDeps);
      return docBase(projectId, deps, "Project summary", [
        { label: "Total cases", value: String(report.totalCases) },
        { label: "Automation coverage", value: `${report.automationCoveragePct}%` },
        { label: "Total runs", value: String(report.totalRuns) },
        { label: "Active runs", value: String(report.activeRuns) },
        { label: "Progress", value: `${report.execution.progress}%` },
        { label: "Passed", value: String(report.execution.passed) },
        { label: "Failed", value: String(report.execution.failed) }
      ], [
        {
          title: "Runs",
          columns: ["Run", "Status", "Tests", "Passed", "Failed", "Progress"],
          rows: report.runs.map((row) => [
            row.name,
            row.status,
            String(row.total),
            String(row.passed),
            String(row.failed),
            `${row.progress}%`
          ])
        }
      ]);
    }

    case "users_workload_summary": {
      const report = await buildUserWorkloadSummaryForProject(projectId, reportDeps);
      return docBase(projectId, deps, "Users workload summary", [
        { label: "Assigned tests", value: String(report.totalAssignedTests) },
        { label: "Active tests", value: String(report.totalActiveTests) },
        { label: "Unassigned active", value: String(report.unassignedActiveCount) }
      ], [
        {
          title: "Users",
          columns: ["User", "Email", "Assigned", "Active", "Passed", "Failed"],
          rows: report.items.map((row) => [
            row.name,
            row.email,
            String(row.assignedCount),
            String(row.activeCount),
            String(row.passedCount),
            String(row.failedCount)
          ])
        }
      ]);
    }

    case "milestone_summary": {
      const summary = await buildMilestoneSummary(projectId, reportDeps);
      return docBase(projectId, deps, "Milestone summary", [
        { label: "Milestones", value: String(summary.items.length) }
      ], [
        {
          title: "Milestones",
          columns: ["Milestone", "Status", "Runs", "Progress", "Passed", "Failed"],
          rows: summary.items.map((row) => [
            row.name,
            row.lifecycleStatus,
            String(row.runCount),
            `${row.progress}%`,
            String(row.passed),
            String(row.failed)
          ])
        }
      ]);
    }

    case "plan_summary": {
      const items = await buildPlanSummaryItems(projectId, reportDeps);
      return docBase(projectId, deps, "Plan summary", [{ label: "Plans", value: String(items.length) }], [
        {
          title: "Test plans",
          columns: ["Plan", "Status", "Entries", "Runs", "Open runs", "Progress"],
          rows: items.map((row) => [
            row.name,
            row.status,
            String(row.entryCount),
            String(row.runCount),
            String(row.openRunCount),
            `${row.progress}%`
          ])
        }
      ]);
    }

    case "case_activity_summary": {
      const query = caseActivitySummaryQuerySchema.parse({
        days: input.days,
        actorUserId: input.actorUserId,
        category: input.category
      });
      const summary = await buildCaseActivitySummaryReport(deps.prisma, projectId, query);
      return docBase(
        projectId,
        deps,
        "Case activity summary",
        [
          { label: "Window (days)", value: String(query.days) },
          { label: "Category", value: query.category },
          { label: "Events", value: String(summary.totalEvents) },
          { label: "Unique cases", value: String(summary.uniqueCaseCount) }
        ],
        [
          {
            title: "By category",
            columns: ["Category", "Count"],
            rows: summary.byCategory.map((row) => [row.category, String(row.count)])
          },
          {
            title: "Recent events",
            columns: ["When", "Type", "Case", "Actor", "Title"],
            rows: summary.recent.slice(0, 100).map((row) => [
              new Date(row.createdAt).toLocaleString(),
              row.eventType,
              row.caseId,
              row.actorName ?? "—",
              row.title
            ])
          }
        ]
      );
    }

    case "cases_property_distribution": {
      const query = casePropertyDistributionQuerySchema.parse({ field: input.field ?? "priority" });
      const report = await buildCasePropertyDistributionReport(projectId, reportDeps, query.field);
      const fieldLabel =
        report.fields.find((field) => field.key === report.selectedField)?.label ?? report.selectedField;
      return docBase(
        projectId,
        deps,
        "Cases property distribution",
        [
          { label: "Field", value: fieldLabel },
          { label: "Total cases", value: String(report.totalCases) }
        ],
        [
          {
            title: "Distribution",
            columns: ["Value", "Count", "Percent"],
            rows: report.items.map((row) => [row.label, String(row.count), `${row.percent}%`])
          }
        ]
      );
    }

    case "status_tops": {
      const report = await buildCaseStatusTopsReport(projectId, reportDeps);
      return docBase(
        projectId,
        deps,
        "Status tops",
        [{ label: "Total tests", value: String(report.totalTests) }],
        [
          {
            title: "Status distribution",
            columns: ["Status", "Count", "Percent"],
            rows: report.items.map((row) => [row.status, String(row.count), `${row.percent}%`])
          }
        ]
      );
    }

    case "defect_summary": {
      const query = defectSummaryQuerySchema.parse({
        milestoneId: input.milestoneId,
        planId: input.planId,
        runId: input.runId
      });
      const report = await buildDefectSummaryReportForProject(projectId, reportDeps, query);
      return docBase(
        projectId,
        deps,
        "Defects summary",
        [
          { label: "Scope", value: report.scope.label },
          { label: "At-risk results", value: String(report.dashboard.atRiskResultCount) },
          { label: "Linked defects", value: String(report.dashboard.linkedDefectCount) }
        ],
        [
          {
            title: "Defects",
            columns: ["Defect", "Linked results", "Failed", "Blocked", "Retest"],
            rows: report.defects.slice(0, 200).map((row) => [
              row.defectKey,
              String(row.linkedResultCount),
              String(row.failedCount),
              String(row.blockedCount),
              String(row.retestCount)
            ])
          }
        ]
      );
    }

    case "results_case_comparison": {
      const query = resultsCaseComparisonQuerySchema.parse({
        runIdA: input.runIdA,
        runIdB: input.runIdB
      });
      const report = await buildResultsCaseComparisonReport(projectId, reportDeps, query);
      return docBase(
        projectId,
        deps,
        "Results comparison for cases",
        [
          { label: "Run A", value: report.runA.name },
          { label: "Run B", value: report.runB.name },
          { label: "Compared cases", value: String(report.items.length) }
        ],
        [
          {
            title: "Case comparison",
            columns: ["Case", "Run A status", "Run B status", "Changed"],
            rows: report.items.slice(0, 200).map((row) => [
              row.title,
              row.statusA,
              row.statusB,
              row.changed ? "yes" : "no"
            ])
          }
        ]
      );
    }

    case "results_property_distribution": {
      const query = resultsPropertyDistributionQuerySchema.parse({
        field: input.property ?? input.field,
        runId: input.runId
      });
      const report = await buildResultsPropertyDistributionReport(projectId, reportDeps, query);
      const fieldLabel =
        report.fields.find((field) => field.key === report.selectedField)?.label ?? report.selectedField;
      return docBase(
        projectId,
        deps,
        "Results property distribution",
        [
          { label: "Property", value: fieldLabel },
          { label: "Results", value: String(report.totalResults) }
        ],
        [
          {
            title: "Distribution",
            columns: ["Value", "Count", "Percent"],
            rows: report.items.map((row) => [row.label, String(row.count), `${row.percent}%`])
          }
        ]
      );
    }

    case "refs_coverage": {
      const report = await buildRefsCoverageReportForProject(projectId, reportDeps);
      return docBase(
        projectId,
        deps,
        "References coverage",
        [
          { label: "References", value: String(report.totalReferences) },
          { label: "Cases with refs", value: String(report.casesWithRefs) },
          { label: "Cases without refs", value: String(report.casesWithoutRefs) }
        ],
        [
          {
            title: "References",
            columns: ["Reference", "Cases", "Coverage"],
            rows: report.items.slice(0, 200).map((row) => [
              row.refKey,
              String(row.linkedCaseCount),
              row.coverageStatus
            ])
          }
        ]
      );
    }

    case "refs_comparison": {
      const query = refsComparisonQuerySchema.parse({
        runIdA: input.runIdA,
        runIdB: input.runIdB
      });
      const report = await buildRefsComparisonReportForProject(projectId, reportDeps, query);
      return docBase(
        projectId,
        deps,
        "References comparison",
        [
          { label: "Run A", value: report.runA.name },
          { label: "Run B", value: report.runB.name }
        ],
        [
          {
            title: "Reference comparison",
            columns: ["Reference", "Run A", "Run B", "Changed"],
            rows: report.items.slice(0, 200).map((row) => [
              row.reference,
              row.statusA,
              row.statusB,
              row.changed ? "yes" : "no"
            ])
          }
        ]
      );
    }

    case "refs_defect_summary": {
      const report = await buildRefsDefectSummaryReportForProject(projectId, reportDeps);
      return docBase(
        projectId,
        deps,
        "References defect summary",
        [
          { label: "References", value: String(report.totalReferences) },
          { label: "Rows", value: String(report.items.length) }
        ],
        [
          {
            title: "References with defects",
            columns: ["Reference", "Cases", "At-risk results", "Linked defects"],
            rows: report.items.slice(0, 200).map((row) => [
              row.refKey,
              String(row.linkedCaseCount),
              String(row.atRiskResultCount),
              String(row.linkedDefectCount)
            ])
          }
        ]
      );
    }

    default:
      throw new Error("UNSUPPORTED_REPORT_PRINT");
  }
}
