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
  defectCoverage: (projectId: string) => [...reportKeys.all(projectId), "defect-coverage"] as const
};

