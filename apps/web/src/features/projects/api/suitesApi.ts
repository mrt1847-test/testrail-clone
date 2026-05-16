import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import type { SuiteSummary } from "../types";

type ApiSuite = {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  isMaster?: boolean;
  isBaseline?: boolean;
  parentSuiteId?: string | null;
};

function mapSuite(row: ApiSuite): SuiteSummary {
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    name: row.name,
    description: row.description ?? null,
    isMaster: row.isMaster ?? false,
    isBaseline: row.isBaseline ?? false,
    parentSuiteId: row.parentSuiteId ? String(row.parentSuiteId) : null
  };
}

export async function fetchSuites(projectId: string): Promise<SuiteSummary[]> {
  const res = await apiFetch<Paged<ApiSuite>>(`/api/projects/${projectId}/suites?page=1&pageSize=100`);
  return res.data.map(mapSuite);
}

export async function createSuite(
  projectId: string,
  input: { name: string; description?: string; isBaseline?: boolean }
): Promise<SuiteSummary> {
  const res = await apiFetch<Ok<ApiSuite>>(`/api/projects/${projectId}/suites`, {
    method: "POST",
    body: input
  });
  return mapSuite(res.data);
}

export async function createBaselineSuite(projectId: string, name: string): Promise<SuiteSummary> {
  const res = await apiFetch<Ok<ApiSuite>>(`/api/projects/${projectId}/suites/baselines`, {
    method: "POST",
    body: { name }
  });
  return mapSuite(res.data);
}
