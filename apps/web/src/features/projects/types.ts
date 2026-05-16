export type ProjectSummary = {
  id: string;
  name: string;
  description?: string;
  isArchived?: boolean;
};

export type ProjectOverviewDto = {
  stats: {
    totalCases: number;
    activeRuns: number;
    recentFailures: number;
    automationCoveragePct: number;
  };
  execution: {
    total: number;
    passed: number;
    failed: number;
    remaining: number;
  };
  recentRuns: Array<{ id: string; name: string; status: string; progress: number; total: number; passed: number; failed: number; createdAt: string }>;
  recentFailures: Array<{ caseCode: string; title: string; runName: string; runId: string; at: string }>;
  recentResults: Array<{ caseCode: string; status: string; source: string; at: string }>;
};
