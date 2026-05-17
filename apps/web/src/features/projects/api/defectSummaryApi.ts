import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type DefectSummaryScope = {
  type: "project" | "milestone" | "plan" | "run";
  id: string | null;
  label: string;
};

export type DefectSummaryReport = {
  scope: DefectSummaryScope;
  dashboard: {
    runCount: number;
    testCount: number;
    atRiskResultCount: number;
    linkedDefectCount: number;
    unlinkedAtRiskCount: number;
  };
  defects: Array<{
    defectKey: string;
    linkedResultCount: number;
    failedCount: number;
    blockedCount: number;
    retestCount: number;
  }>;
  unlinkedAtRisk: Array<{
    runId: string;
    runName: string;
    testId: string;
    caseId: string;
    title: string;
    status: string;
    resultId: string;
    createdAt: string;
  }>;
  runs: Array<{
    runId: string;
    runName: string;
    testCount: number;
    atRiskResultCount: number;
    linkedDefectCount: number;
    unlinkedAtRiskCount: number;
  }>;
};

export type DefectSummaryQuery = {
  milestoneId?: string;
  planId?: string;
  runId?: string;
};

export async function fetchDefectSummary(projectId: string, query?: DefectSummaryQuery) {
  const qs = new URLSearchParams();
  if (query?.milestoneId) qs.set("milestoneId", query.milestoneId);
  if (query?.planId) qs.set("planId", query.planId);
  if (query?.runId) qs.set("runId", query.runId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch<Ok<DefectSummaryReport>>(
    `/api/projects/${projectId}/reports/defect-summary${suffix}`
  );
  return res.data;
}
