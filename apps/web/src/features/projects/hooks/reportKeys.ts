export const reportKeys = {
  all: (projectId: string) => ["reports", projectId] as const,
  statusDistribution: (projectId: string) =>
    [...reportKeys.all(projectId), "status-distribution"] as const,
  failureTrend: (projectId: string) => [...reportKeys.all(projectId), "failure-trend"] as const,
  runSummary: (projectId: string) => [...reportKeys.all(projectId), "run-summary"] as const,
  milestoneSummary: (projectId: string) => [...reportKeys.all(projectId), "milestone-summary"] as const,
  planSummary: (projectId: string) => [...reportKeys.all(projectId), "plan-summary"] as const,
  traceability: (projectId: string) => [...reportKeys.all(projectId), "traceability"] as const,
  refsTraceability: (projectId: string) => [...reportKeys.all(projectId), "refs-traceability"] as const,
  coverageGap: (projectId: string) => [...reportKeys.all(projectId), "coverage-gap"] as const,
  defectCoverage: (projectId: string) => [...reportKeys.all(projectId), "defect-coverage"] as const,
  defectSummary: (projectId: string, query?: { milestoneId?: string; planId?: string; runId?: string }) =>
    [...reportKeys.all(projectId), "defect-summary", query ?? {}] as const,
  caseActivitySummary: (
    projectId: string,
    query?: { days?: number; category?: string }
  ) => [...reportKeys.all(projectId), "case-activity-summary", query ?? {}] as const,
  casePropertyDistribution: (projectId: string, field: string) =>
    [...reportKeys.all(projectId), "cases-property-distribution", field] as const,
  statusTops: (projectId: string) => [...reportKeys.all(projectId), "status-tops"] as const,
  resultsCaseComparison: (projectId: string, runIdA: string, runIdB: string) =>
    [...reportKeys.all(projectId), "results-case-comparison", runIdA, runIdB] as const,
  resultsPropertyDistribution: (
    projectId: string,
    query?: { field?: string; runId?: string }
  ) => [...reportKeys.all(projectId), "results-property-distribution", query ?? {}] as const,
  refsCoverage: (projectId: string) => [...reportKeys.all(projectId), "refs-coverage"] as const,
  refsComparison: (projectId: string, runIdA: string, runIdB: string) =>
    [...reportKeys.all(projectId), "refs-comparison", runIdA, runIdB] as const,
  refsDefectSummary: (projectId: string) =>
    [...reportKeys.all(projectId), "refs-defect-summary"] as const,
  projectSummary: (projectId: string) => [...reportKeys.all(projectId), "project-summary"] as const,
  usersWorkloadSummary: (projectId: string) =>
    [...reportKeys.all(projectId), "users-workload-summary"] as const
};

