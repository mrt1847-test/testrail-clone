import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type CaseActivityCategory = "created" | "updated" | "deleted" | "other";

export type CaseActivitySummary = {
  totalEvents: number;
  uniqueCaseCount: number;
  byDay: Array<{
    date: string;
    created: number;
    updated: number;
    deleted: number;
    other: number;
    total: number;
  }>;
  byCategory: Array<{ category: CaseActivityCategory; count: number }>;
  byActor: Array<{ actorUserId: string | null; actorName: string; count: number }>;
  recent: Array<{
    id: string;
    eventType: string;
    category: CaseActivityCategory;
    caseId: string;
    title: string;
    body: string | null;
    actorUserId: string | null;
    actorName: string;
    createdAt: string;
  }>;
};

export type CaseActivitySummaryQuery = {
  days?: number;
  category?: "created" | "updated" | "deleted" | "other" | "all";
};

export async function fetchCaseActivitySummary(projectId: string, query?: CaseActivitySummaryQuery) {
  const qs = new URLSearchParams();
  if (query?.days != null) qs.set("days", String(query.days));
  if (query?.category) qs.set("category", query.category);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch<Ok<CaseActivitySummary>>(
    `/api/projects/${projectId}/reports/case-activity-summary${suffix}`
  );
  return res.data;
}
