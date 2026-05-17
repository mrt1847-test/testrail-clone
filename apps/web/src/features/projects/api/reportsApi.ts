import { downloadCsv } from "./importExportApi";

export type ReportExportType =
  | "run_summary"
  | "milestone_summary"
  | "plan_summary"
  | "results_explorer"
  | "traceability"
  | "coverage_gap"
  | "defect_coverage"
  | "defect_summary"
  | "case_activity_summary"
  | "cases_property_distribution"
  | "status_tops"
  | "results_case_comparison"
  | "results_property_distribution"
  | "refs_coverage"
  | "refs_comparison"
  | "refs_defect_summary"
  | "project_summary"
  | "users_workload_summary";

const fileNames: Record<ReportExportType, string> = {
  run_summary: "run-summary.csv",
  milestone_summary: "milestone-summary.csv",
  plan_summary: "plan-summary.csv",
  results_explorer: "results-explorer.csv",
  traceability: "traceability.csv",
  coverage_gap: "coverage-gap.csv",
  defect_coverage: "defect-coverage.csv",
  defect_summary: "defect-summary.csv",
  case_activity_summary: "case-activity-summary.csv",
  cases_property_distribution: "cases-property-distribution.csv",
  status_tops: "status-tops.csv",
  results_case_comparison: "results-case-comparison.csv",
  results_property_distribution: "results-property-distribution.csv",
  refs_coverage: "refs-coverage.csv",
  refs_comparison: "refs-comparison.csv",
  refs_defect_summary: "refs-defect-summary.csv",
  project_summary: "project-summary.csv",
  users_workload_summary: "users-workload-summary.csv"
};

export async function downloadReportCsv(
  projectId: string,
  reportType: ReportExportType,
  query?: Record<string, string | undefined>
) {
  const qs = new URLSearchParams({ reportType, format: "csv" });
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && String(value).trim().length > 0) qs.set(key, String(value).trim());
    }
  }
  await downloadCsv(`/api/projects/${projectId}/reports/export?${qs.toString()}`, fileNames[reportType]);
}
