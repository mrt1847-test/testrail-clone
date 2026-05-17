import type { ReportExportType } from "../../projects/api/reportsApi";
import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";
import type { PrintDocument } from "./printApi";

export const REPORT_PRINT_SLUG_BY_TYPE: Partial<Record<ReportExportType, string>> = {
  project_summary: "project-summary",
  users_workload_summary: "users-workload",
  milestone_summary: "milestones",
  plan_summary: "plans",
  case_activity_summary: "case-activity",
  cases_property_distribution: "case-properties",
  status_tops: "status-tops",
  defect_summary: "defect-summary",
  results_case_comparison: "results-comparison",
  results_property_distribution: "results-properties",
  refs_coverage: "refs-coverage",
  refs_comparison: "refs-comparison",
  refs_defect_summary: "refs-defects"
};

const REPORT_TYPE_BY_SLUG = Object.fromEntries(
  Object.entries(REPORT_PRINT_SLUG_BY_TYPE).map(([type, slug]) => [slug, type])
) as Record<string, ReportExportType>;

export function reportSlugForType(reportType: ReportExportType) {
  return REPORT_PRINT_SLUG_BY_TYPE[reportType];
}

export function reportTypeForSlug(slug: string) {
  return REPORT_TYPE_BY_SLUG[slug];
}

export function buildReportPrintPath(
  projectId: string,
  reportType: ReportExportType,
  query?: Record<string, string | undefined>
) {
  const slug = reportSlugForType(reportType);
  if (!slug) return null;
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && String(value).trim().length > 0) params.set(key, String(value).trim());
    }
  }
  const qs = params.toString();
  return `/projects/${projectId}/reports/print/${slug}${qs ? `?${qs}` : ""}`;
}

export async function fetchReportPrintDocument(
  projectId: string,
  reportType: ReportExportType,
  query?: Record<string, string | undefined>
) {
  const params = new URLSearchParams({ reportType });
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && String(value).trim().length > 0) params.set(key, String(value).trim());
    }
  }
  const res = await apiFetch<Ok<PrintDocument>>(
    `/api/projects/${projectId}/reports/print?${params.toString()}`
  );
  return res.data;
}
