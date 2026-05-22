import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type GlobalSearchEntityType = "case" | "run" | "milestone" | "plan" | "defect";

export type GlobalSearchHit = {
  entityType: GlobalSearchEntityType;
  id: string;
  title: string;
  subtitle: string | null;
  path: string;
};

export type GlobalSearchResponse = {
  query: string;
  items: GlobalSearchHit[];
};

export type CrossProjectGlobalSearchHit = GlobalSearchHit & {
  projectId: string;
  projectName: string;
};

export type CrossProjectGlobalSearchResponse = {
  query: string;
  items: CrossProjectGlobalSearchHit[];
};

export async function fetchProjectGlobalSearch(projectId: string, query: string): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams({ q: query.trim() });
  const res = await apiFetch<Ok<GlobalSearchResponse>>(`/api/projects/${projectId}/search?${params.toString()}`);
  return res.data;
}

export async function fetchCrossProjectGlobalSearch(query: string): Promise<CrossProjectGlobalSearchResponse> {
  const params = new URLSearchParams({ q: query.trim() });
  const res = await apiFetch<Ok<CrossProjectGlobalSearchResponse>>(`/api/search?${params.toString()}`);
  return res.data;
}
