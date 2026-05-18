import type { ReportExportType } from "../api/reportsApi";
import { buildReportPageHref } from "../reports/reportRoutes";

export type ContentHeaderReportContext = "overview" | "cases" | "runs" | "run-detail" | "milestones";

export type ReportMenuItem = {
  label: string;
  href: string;
  description?: string;
};

export function reportMenuItems(
  projectId: string,
  context: ContentHeaderReportContext,
  scope?: { suiteId?: string; runId?: string }
): ReportMenuItem[] {
  const suiteQuery = scope?.suiteId ? { suiteId: scope.suiteId } : undefined;
  const runQuery = scope?.runId ? { runId: scope.runId, scopeType: "run", scopeId: scope.runId } : undefined;

  const item = (type: ReportExportType, label: string, filters?: Record<string, string>, description?: string) => ({
    label,
    href: buildReportPageHref(projectId, type, filters),
    description
  });

  switch (context) {
    case "cases":
      return [
        item("case_activity_summary", "Case activity summary", suiteQuery),
        item("cases_property_distribution", "Cases property distribution", suiteQuery),
        item("refs_coverage", "References coverage"),
        item("traceability", "Traceability"),
        item("coverage_gap", "Coverage gap")
      ];
    case "runs":
      return [
        item("run_summary", "Runs summary"),
        item("results_explorer", "Results explorer"),
        item("status_tops", "Status tops"),
        item("users_workload_summary", "Users workload")
      ];
    case "run-detail":
      return [
        item("defect_summary", "Defect summary", runQuery),
        item("results_explorer", "Results explorer", runQuery),
        item("run_summary", "Runs summary"),
        item("traceability", "Traceability")
      ];
    case "milestones":
      return [
        item("milestone_summary", "Milestone summary"),
        item("run_summary", "Runs summary"),
        item("plan_summary", "Plan summary")
      ];
    case "overview":
    default:
      return [
        item("project_summary", "Project summary"),
        item("milestone_summary", "Milestone summary"),
        item("run_summary", "Runs summary"),
        item("defect_summary", "Defect summary"),
        item("defect_coverage", "Defect coverage")
      ];
  }
}
