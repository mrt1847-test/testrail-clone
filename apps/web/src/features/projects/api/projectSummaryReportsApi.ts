import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type ProjectExecutionSummaryReport = {
  totalCases: number;
  automationCoveragePct: number;
  totalRuns: number;
  activeRuns: number;
  completedRuns: number;
  execution: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    retest: number;
    untested: number;
    progress: number;
  };
  runs: Array<{
    runId: string;
    name: string;
    status: string;
    total: number;
    passed: number;
    failed: number;
    progress: number;
  }>;
};

export type UsersWorkloadSummaryReport = {
  totalAssignees: number;
  totalAssignedTests: number;
  totalActiveTests: number;
  unassignedActiveCount: number;
  items: Array<{
    userId: string;
    name: string;
    email: string;
    assignedCount: number;
    activeCount: number;
    passedCount: number;
    failedCount: number;
    blockedCount: number;
    retestCount: number;
    untestedCount: number;
    overdueCount: number;
    dueSoonCount: number;
    staleCount: number;
  }>;
};

export async function fetchProjectExecutionSummary(projectId: string) {
  const res = await apiFetch<Ok<ProjectExecutionSummaryReport>>(
    `/api/projects/${projectId}/reports/project-summary`
  );
  return res.data;
}

export async function fetchUsersWorkloadSummary(projectId: string) {
  const res = await apiFetch<Ok<UsersWorkloadSummaryReport>>(
    `/api/projects/${projectId}/reports/users-workload-summary`
  );
  return res.data;
}
