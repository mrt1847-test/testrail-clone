import type { ReportExportType } from "../api/reportsApi";

export const REPORT_TYPE_LABELS: Record<ReportExportType, string> = {
  run_summary: "Run summary",
  milestone_summary: "Milestone summary",
  plan_summary: "Plan summary",
  results_explorer: "Results explorer",
  traceability: "Traceability",
  coverage_gap: "Coverage gap",
  defect_coverage: "Defect coverage",
  defect_summary: "Defect summary",
  case_activity_summary: "Case activity summary",
  cases_property_distribution: "Cases property distribution",
  status_tops: "Status tops",
  results_case_comparison: "Results comparison (cases)",
  results_property_distribution: "Results property distribution",
  refs_coverage: "References coverage",
  refs_comparison: "References comparison",
  refs_defect_summary: "References defect summary",
  project_summary: "Project summary",
  users_workload_summary: "Users workload summary"
};

export function reportPagePath(projectId: string, reportType: ReportExportType): string {
  const base = `/projects/${projectId}/reports`;
  switch (reportType) {
    case "run_summary":
      return `${base}/runs`;
    case "milestone_summary":
      return `${base}/milestones`;
    case "plan_summary":
      return `${base}/plans`;
    case "results_explorer":
      return `${base}/explorer`;
    case "traceability":
      return `${base}/traceability`;
    case "coverage_gap":
      return `${base}/coverage`;
    case "defect_coverage":
      return `${base}/defects`;
    case "defect_summary":
      return `${base}/defect-summary`;
    case "case_activity_summary":
      return `${base}/case-activity`;
    case "cases_property_distribution":
      return `${base}/case-properties`;
    case "status_tops":
      return `${base}/status-tops`;
    case "results_case_comparison":
      return `${base}/results-comparison`;
    case "results_property_distribution":
      return `${base}/results-properties`;
    case "refs_coverage":
      return `${base}/refs-coverage`;
    case "refs_comparison":
      return `${base}/refs-comparison`;
    case "refs_defect_summary":
      return `${base}/refs-defects`;
    case "project_summary":
      return `${base}/project-summary`;
    case "users_workload_summary":
      return `${base}/users-workload`;
    default:
      return base;
  }
}

export function buildReportPageHref(
  projectId: string,
  reportType: ReportExportType,
  uiFilters?: Record<string, string>
): string {
  const path = reportPagePath(projectId, reportType);
  if (!uiFilters || Object.keys(uiFilters).length === 0) return path;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(uiFilters)) {
    if (value.trim().length > 0) qs.set(key, value.trim());
  }
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}
