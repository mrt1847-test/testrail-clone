import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type ResultsCaseComparisonReport = {
  runA: { runId: string; name: string };
  runB: { runId: string; name: string };
  summary: {
    comparedCaseCount: number;
    sharedCaseCount: number;
    changedCount: number;
    unchangedCount: number;
    onlyInRunACount: number;
    onlyInRunBCount: number;
  };
  items: Array<{
    caseId: string;
    title: string;
    statusA: string | null;
    statusB: string | null;
    testIdA: string | null;
    testIdB: string | null;
    changed: boolean;
    onlyInRunA: boolean;
    onlyInRunB: boolean;
  }>;
};

export type ResultPropertyDistributionReport = {
  selectedField: string;
  fields: Array<{ key: string; label: string; type: "system" | "custom" }>;
  totalResults: number;
  runId: string | null;
  items: Array<{ value: string; label: string; count: number; percent: number }>;
};

export async function fetchResultsCaseComparison(projectId: string, runIdA: string, runIdB: string) {
  const qs = new URLSearchParams({ runIdA, runIdB });
  const res = await apiFetch<Ok<ResultsCaseComparisonReport>>(
    `/api/projects/${projectId}/reports/results-case-comparison?${qs.toString()}`
  );
  return res.data;
}

export async function fetchResultsPropertyDistribution(
  projectId: string,
  options?: { field?: string; runId?: string }
) {
  const qs = new URLSearchParams();
  if (options?.field) qs.set("field", options.field);
  if (options?.runId) qs.set("runId", options.runId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch<Ok<ResultPropertyDistributionReport>>(
    `/api/projects/${projectId}/reports/results-property-distribution${suffix}`
  );
  return res.data;
}
