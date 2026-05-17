import { API_BASE, apiFetch, getAccessToken } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type CaseScenarioRow = {
  id: string;
  scenarioOrder: number;
  name: string;
  content: string;
};

export async function fetchCaseScenarios(caseId: string): Promise<CaseScenarioRow[]> {
  const res = await apiFetch<Ok<CaseScenarioRow[]>>(`/api/cases/${caseId}/scenarios`);
  return res.data.map((row) => ({
    ...row,
    id: String(row.id),
    scenarioOrder: row.scenarioOrder
  }));
}

export async function createCaseScenario(caseId: string, input: { name: string; content: string }) {
  const res = await apiFetch<Ok<CaseScenarioRow>>(`/api/cases/${caseId}/scenarios`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return { ...res.data, id: String(res.data.id) };
}

export async function replaceCaseScenarios(
  caseId: string,
  scenarios: Array<{ name: string; content: string }>
) {
  const res = await apiFetch<Ok<CaseScenarioRow[]>>(`/api/cases/${caseId}/scenarios`, {
    method: "PUT",
    body: JSON.stringify({ scenarios })
  });
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function importBddFeature(
  projectId: string,
  input: { sectionId: string; featureText: string; createOneCasePerFeature?: boolean }
) {
  const res = await apiFetch<
    Ok<{
      importedCases: number;
      cases: Array<{ caseId: string; title: string; scenarios: number }>;
    }>
  >(`/api/projects/${projectId}/bdd/features/import`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return res.data;
}

export async function exportBddFeature(projectId: string, params: { sectionId?: string; caseId?: string }) {
  const search = new URLSearchParams();
  if (params.sectionId) search.set("sectionId", params.sectionId);
  if (params.caseId) search.set("caseId", params.caseId);
  const query = search.toString();
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/bdd/features/export${query ? `?${query}` : ""}`, {
    credentials: "include",
    headers
  });
  if (!res.ok) throw new Error(await res.text());
  return res.text();
}
