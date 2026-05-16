import { apiFetch } from "../../../shared/api/http";

type Ok<T> = { data: T };

export type ReferenceUrlItem = { key: string; url: string | null };
export type IssueSearchItem = { key: string; label: string; url: string | null };

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
