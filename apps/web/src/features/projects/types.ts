export type ProjectSummary = {
  id: string;
  name: string;
  description?: string;
};

export type ProjectOverviewDto = {
  stats: {
    totalCases: number;
    activeRuns: number;
    recentFailures: number;
    automationCoveragePct: number;
  };
  recentRuns: Array<{ id: string; name: string; status: string; progress: number; createdAt: string }>;
  recentFailures: Array<{ caseCode: string; title: string; runName: string; at: string }>;
  recentResults: Array<{ caseCode: string; status: string; source: string; at: string }>;
};
