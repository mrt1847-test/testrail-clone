import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type RefsCoverageReport = {
  totalReferences: number;
  casesWithRefs: number;
  casesWithoutRefs: number;
  items: Array<{
    refKey: string;
    linkedCaseCount: number;
    latestStatuses: string[];
    coverageStatus: string;
    caseIds: string[];
  }>;
};

export type RefsComparisonReport = {
  runA: { runId: string; name: string };
  runB: { runId: string; name: string };
  summary: {
    comparedRefCount: number;
    sharedRefCount: number;
    changedCount: number;
    unchangedCount: number;
    onlyInRunACount: number;
    onlyInRunBCount: number;
  };
  items: Array<{
    refKey: string;
    linkedCaseCount: number;
    statusA: string | null;
    statusB: string | null;
    changed: boolean;
    onlyInRunA: boolean;
    onlyInRunB: boolean;
    caseIds: string[];
  }>;
};

export async function fetchRefsCoverage(projectId: string) {
  const res = await apiFetch<Ok<RefsCoverageReport>>(`/api/projects/${projectId}/reports/refs-coverage`);
  return res.data;
}

export async function fetchRefsComparison(projectId: string, runIdA: string, runIdB: string) {
  const qs = new URLSearchParams({ runIdA, runIdB });
  const res = await apiFetch<Ok<RefsComparisonReport>>(
    `/api/projects/${projectId}/reports/refs-comparison?${qs.toString()}`
  );
  return res.data;
}

export type RefsDefectSummaryReport = {
  totalReferences: number;
  items: Array<{
    refKey: string;
    linkedCaseCount: number;
    atRiskResultCount: number;
    linkedDefectCount: number;
    defectKeys: string[];
    defectCoverage: "not_applicable" | "linked" | "unlinked";
    caseIds: string[];
  }>;
};

export async function fetchRefsDefectSummary(projectId: string) {
  const res = await apiFetch<Ok<RefsDefectSummaryReport>>(
    `/api/projects/${projectId}/reports/refs-defect-summary`
  );
  return res.data;
}
