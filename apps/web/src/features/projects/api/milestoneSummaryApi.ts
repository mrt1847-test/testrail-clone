import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";
import type { MilestoneLifecycleStatus } from "./planningApi";

export type MilestoneScheduleStatus =
  | "completed"
  | "no_schedule"
  | "not_started"
  | "on_track"
  | "at_risk"
  | "overdue";

export type BurndownPoint = {
  date: string;
  idealRemaining: number;
  actualRemaining: number | null;
};

export type MilestoneForecast = {
  scheduleStatus: MilestoneScheduleStatus;
  remainingTests: number;
  executedTests: number;
  daysElapsed: number | null;
  daysRemaining: number | null;
  daysTotal: number | null;
  velocityPerDay: number | null;
  projectedCompletionDate: string | null;
  projectedOnTime: boolean | null;
  hint: string;
  burndown: BurndownPoint[];
};

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
  forecast: MilestoneForecast;
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
