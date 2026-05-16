import { downloadCsv } from "./importExportApi";

export type ReportExportType =
  | "run_summary"
  | "milestone_summary"
  | "plan_summary"
  | "results_explorer"
  | "traceability"
  | "coverage_gap"
  | "defect_coverage";

const fileNames: Record<ReportExportType, string> = {
  run_summary: "run-summary.csv",
  milestone_summary: "milestone-summary.csv",
  plan_summary: "plan-summary.csv",
  results_explorer: "results-explorer.csv",
  traceability: "traceability.csv",
  coverage_gap: "coverage-gap.csv",
  defect_coverage: "defect-coverage.csv"
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
