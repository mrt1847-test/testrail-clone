import type { ReportExportType } from "../api/reportsApi";

export const REPORT_TYPE_LABELS: Record<ReportExportType, string> = {
  run_summary: "Run summary",
  milestone_summary: "Milestone summary",
  plan_summary: "Plan summary",
  results_explorer: "Results explorer",
  traceability: "Traceability",
  coverage_gap: "Coverage gap",
  defect_coverage: "Defect coverage"
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
