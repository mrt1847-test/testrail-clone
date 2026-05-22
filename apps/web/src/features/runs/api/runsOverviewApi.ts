import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type RunPlanOverviewItemType = "run" | "plan";

export type RunPlanOverviewItem = {
  id: string;
  type: RunPlanOverviewItemType;
  name: string;
  createdAt: string;
  createdBy: string | null;
  statusCounts: Record<string, number>;
  percentPassed: number;
  percentComplete: number;
  totalTests: number;
  editPath: string;
  viewPath: string;
};

export type CompletedOverviewItem = {
  id: string;
  type: RunPlanOverviewItemType;
  name: string;
  percentPassed: number;
  closedAt: string;
  viewPath: string;
};

export type RunsOverviewDto = {
  open: { total: number; items: RunPlanOverviewItem[] };
  completed: { total: number; groups: Array<{ date: string; items: CompletedOverviewItem[] }> };
  counts: { open: number; completed: number };
};

export type RunsOverviewQuery = {
  mine?: boolean;
  milestoneId?: string | null;
  orderBy?: "date" | "name";
};

export async function fetchRunsOverview(projectId: string, query: RunsOverviewQuery = {}): Promise<RunsOverviewDto> {
  const params = new URLSearchParams();
  if (query.mine) params.set("mine", "1");
  if (query.milestoneId) params.set("milestoneId", query.milestoneId);
  if (query.orderBy) params.set("orderBy", query.orderBy);
  const qs = params.toString();
  const res = await apiFetch<Ok<RunsOverviewDto>>(
    `/api/projects/${projectId}/runs-overview${qs ? `?${qs}` : ""}`
  );
  return res.data;
}
