import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";
import type { MilestoneLifecycleStatus } from "./planningApi";

export type MilestoneSummaryRow = {
  milestoneId: string;
  name: string;
  parentMilestoneId: string | null;
  isCompleted: boolean;
  lifecycleStatus: MilestoneLifecycleStatus;
  childCount: number;
  runCount: number;
  openRunCount: number;
  total: number;
  passed: number;
  failed: number;
  progress: number;
  directRunCount: number;
  directTotal: number;
  directProgress: number;
  includesSubMilestones: boolean;
};

export type MilestoneDashboardTopItem = {
  milestoneId: string;
  name: string;
  parentMilestoneId: string | null;
  lifecycleStatus: MilestoneLifecycleStatus;
  childCount: number;
  progress: number;
  runCount: number;
  includesSubMilestones: boolean;
};

export type MilestoneDashboard = {
  milestoneCount: number;
  rootCount: number;
  openCount: number;
  upcomingCount: number;
  completedCount: number;
  withSubMilestonesCount: number;
  linkedRunCount: number;
  totalTests: number;
  passed: number;
  failed: number;
  progress: number;
  topMilestones: MilestoneDashboardTopItem[];
};

export type MilestoneSummaryPayload = {
  items: MilestoneSummaryRow[];
  dashboard: MilestoneDashboard;
};

export async function fetchMilestoneSummary(projectId: string) {
  const res = await apiFetch<Ok<MilestoneSummaryPayload>>(
    `/api/projects/${projectId}/reports/milestone-summary`
  );
  return res.data;
}
