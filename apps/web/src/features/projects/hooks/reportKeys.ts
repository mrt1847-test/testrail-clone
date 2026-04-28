export const reportKeys = {
  all: (projectId: string) => ["reports", projectId] as const,
  statusDistribution: (projectId: string) =>
    [...reportKeys.all(projectId), "status-distribution"] as const,
  failureTrend: (projectId: string) => [...reportKeys.all(projectId), "failure-trend"] as const,
  runSummary: (projectId: string) => [...reportKeys.all(projectId), "run-summary"] as const
};

