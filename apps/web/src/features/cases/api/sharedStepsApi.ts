import { apiFetch } from "../../../shared/api/http";

export type SharedStepEntry = {
  id?: string;
  stepOrder?: number;
  content: string;
  expectedResult?: string | null;
};

export type SharedStepSummary = {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  entries: SharedStepEntry[];
  linkedCaseCount: number;
};

export type SharedStepDetail = SharedStepSummary & {
  caseIds: string[];
};

type ApiSharedStep = {
  id: string | number | bigint;
  projectId: string | number | bigint;
  title: string;
  createdAt: string;
  updatedAt: string;
  entries: Array<{
    id?: string | number | bigint;
    stepOrder?: number;
    content: string;
    expectedResult?: string | null;
  }>;
  linkedCaseCount?: number;
  caseIds?: Array<string | number | bigint>;
};

function mapSharedStep(row: ApiSharedStep): SharedStepSummary {
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    linkedCaseCount: row.linkedCaseCount ?? 0,
    entries: row.entries.map((entry, index) => ({
      id: entry.id != null ? String(entry.id) : undefined,
      stepOrder: entry.stepOrder ?? index + 1,
      content: entry.content,
      expectedResult: entry.expectedResult ?? null
    }))
  };
}

export async function fetchSharedSteps(projectId: string): Promise<SharedStepSummary[]> {
  const rows = await apiFetch<ApiSharedStep[]>(`/api/projects/${projectId}/shared-steps`);
  return rows.map(mapSharedStep);
}

export async function fetchSharedStep(projectId: string, sharedStepId: string): Promise<SharedStepDetail> {
  const row = await apiFetch<ApiSharedStep>(`/api/projects/${projectId}/shared-steps/${sharedStepId}`);
  const summary = mapSharedStep(row);
  return {
    ...summary,
    caseIds: (row.caseIds ?? []).map((id) => String(id))
  };
}

export async function createSharedStep(
  projectId: string,
  input: { title: string; entries: Array<{ content: string; expectedResult?: string | null }> }
): Promise<SharedStepSummary> {
  const response = await apiFetch<{ data: ApiSharedStep }>(`/api/projects/${projectId}/shared-steps`, {
    method: "POST",
    body: JSON.stringify(input)
  });
  return mapSharedStep(response.data);
}

export async function updateSharedStep(
  projectId: string,
  sharedStepId: string,
  input: { title?: string; entries?: Array<{ content: string; expectedResult?: string | null }> }
): Promise<SharedStepSummary> {
  const response = await apiFetch<{ data: ApiSharedStep }>(
    `/api/projects/${projectId}/shared-steps/${sharedStepId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input)
    }
  );
  return mapSharedStep(response.data);
}

export async function deleteSharedStep(projectId: string, sharedStepId: string): Promise<void> {
  await apiFetch<void>(`/api/projects/${projectId}/shared-steps/${sharedStepId}`, { method: "DELETE" });
}

export async function linkSharedStepToCase(caseId: number, sharedStepId: string): Promise<void> {
  await apiFetch(`/api/cases/${caseId}/shared-steps/${sharedStepId}`, { method: "POST" });
}
