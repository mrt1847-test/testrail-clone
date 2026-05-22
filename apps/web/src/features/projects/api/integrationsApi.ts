import { apiFetch } from "../../../shared/api/http";

type Ok<T> = { data: T };

export type ReferenceUrlItem = { key: string; url: string | null };
export type IssueSearchItem = { key: string; label: string; url: string | null };
export type RecentDefectItem = { key: string; label: string; url: string | null; lastUsedAt: string };

export async function fetchReferenceUrls(
  projectId: string,
  keys: string[]
): Promise<{ items: ReferenceUrlItem[]; integrationEnabled: boolean }> {
  if (keys.length === 0) {
    return { items: [], integrationEnabled: false };
  }
  const res = await apiFetch<
    Ok<{ items: ReferenceUrlItem[]; integrationEnabled: boolean }>
  >(
    `/api/projects/${projectId}/integrations/defects/reference-urls?keys=${encodeURIComponent(keys.join(","))}`
  );
  return res.data;
}

export async function searchIntegrationIssues(
  projectId: string,
  q: string,
  limit = 10
): Promise<{ items: IssueSearchItem[]; integrationEnabled: boolean }> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const res = await apiFetch<Ok<{ items: IssueSearchItem[]; integrationEnabled: boolean }>>(
    `/api/projects/${projectId}/integrations/defects/issues/search?${params}`
  );
  return res.data;
}

export async function fetchRecentDefects(
  projectId: string,
  limit = 12
): Promise<{ items: RecentDefectItem[]; integrationEnabled: boolean }> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await apiFetch<Ok<{ items: RecentDefectItem[]; integrationEnabled: boolean }>>(
    `/api/projects/${projectId}/integrations/defects/recent?${params}`
  );
  return res.data;
}
