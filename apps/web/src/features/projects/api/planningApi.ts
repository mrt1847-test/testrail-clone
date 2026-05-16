import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";

export type TokenScopeOption = {
  scope: string;
  label: string;
};

export type TokenRow = {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt?: string;
};

export type MilestoneRow = {
  id: string;
  name: string;
  isCompleted: boolean;
  startDate?: string | null;
  dueDate?: string | null;
};

export type MilestoneRunRow = {
  runId: string;
  runName: string;
  status: string;
  progress: number;
};

export type PlanRow = {
  id: string;
  name: string;
};

export type PlanEntryRow = {
  id: string;
  name: string;
  environment?: string;
  runId?: string;
};

export type ConfigurationGroupRow = {
  id: string;
  name: string;
  displayOrder: number;
  configurations: Array<{
    id: string;
    name: string;
    displayOrder: number;
  }>;
};

export type PlanMatrixResponse = {
  planId: string;
  planName: string;
  entryId: string | null;
  selectedConfigurationIds: string[];
  groups: ConfigurationGroupRow[];
};

export type PlanRollupRow = {
  configurationId: string;
  configurationName: string;
  groupId: string;
  groupName: string;
  entryCount: number;
  runCount: number;
  openRunCount: number;
  closedRunCount: number;
  passed: number;
  failed: number;
  blocked: number;
  retest: number;
  untested: number;
};

export type PlanEntryConfigurationMapping = {
  entryId: string;
  configurationIds: string[];
  items: Array<{
    configurationId: string;
    configurationName: string;
    groupId: string | null;
    groupName: string | null;
  }>;
};

export async function fetchTokenScopes(projectId: string): Promise<TokenScopeOption[]> {
  const res = await apiFetch<{ data: TokenScopeOption[] }>(`/api/projects/${projectId}/tokens/scopes`);
  return res.data;
}

export async function fetchTokens(projectId: string): Promise<TokenRow[]> {
  const res = await apiFetch<Paged<TokenRow>>(`/api/projects/${projectId}/tokens`);
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function createToken(
  projectId: string,
  input: { name: string; scopes: string[]; expiresInDays: number | null }
) {
  const res = await apiFetch<{ data: TokenRow; rawToken: string }>(`/api/projects/${projectId}/tokens`, {
    method: "POST",
    body: {
      name: input.name,
      scopes: input.scopes,
      expiresInDays: input.expiresInDays
    }
  });
  return {
    token: { ...res.data, id: String(res.data.id) },
    rawToken: res.rawToken
  };
}

export async function revokeToken(projectId: string, tokenId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/tokens/${tokenId}`, { method: "DELETE" });
}

export async function fetchMilestones(projectId: string): Promise<MilestoneRow[]> {
  const res = await apiFetch<Paged<MilestoneRow>>(`/api/projects/${projectId}/milestones`);
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function createMilestone(projectId: string, name: string): Promise<MilestoneRow> {
  const res = await apiFetch<Ok<MilestoneRow>>(`/api/projects/${projectId}/milestones`, {
    method: "POST",
    body: { name }
  });
  return { ...res.data, id: String(res.data.id) };
}

export async function fetchMilestone(projectId: string, milestoneId: string): Promise<MilestoneRow> {
  const res = await apiFetch<Ok<MilestoneRow>>(`/api/projects/${projectId}/milestones/${milestoneId}`);
  return { ...res.data, id: String(res.data.id) };
}

export async function updateMilestone(input: {
  projectId: string;
  milestoneId: string;
  name?: string;
  isCompleted?: boolean;
}): Promise<MilestoneRow> {
  const res = await apiFetch<Ok<MilestoneRow>>(`/api/projects/${input.projectId}/milestones/${input.milestoneId}`, {
    method: "PATCH",
    body: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isCompleted !== undefined ? { isCompleted: input.isCompleted } : {})
    }
  });
  return { ...res.data, id: String(res.data.id) };
}

export async function deleteMilestone(projectId: string, milestoneId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/milestones/${milestoneId}`, { method: "DELETE" });
}

export async function fetchMilestoneRuns(projectId: string, milestoneId: string): Promise<MilestoneRunRow[]> {
  const res = await apiFetch<Paged<MilestoneRunRow>>(`/api/projects/${projectId}/milestones/${milestoneId}/runs`);
  return res.data.map((row) => ({ ...row, runId: String(row.runId) }));
}

export async function fetchPlans(projectId: string): Promise<PlanRow[]> {
  const res = await apiFetch<Paged<PlanRow>>(`/api/projects/${projectId}/plans`);
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function fetchPlan(projectId: string, planId: string): Promise<PlanRow> {
  const res = await apiFetch<Ok<PlanRow>>(`/api/projects/${projectId}/plans/${planId}`);
  return { ...res.data, id: String(res.data.id) };
}

export async function fetchPlanEntries(projectId: string, planId: string): Promise<PlanEntryRow[]> {
  const res = await apiFetch<Paged<PlanEntryRow>>(`/api/projects/${projectId}/plans/${planId}/entries`);
  return res.data.map((row) => ({
    ...row,
    id: String(row.id),
    runId: row.runId ? String(row.runId) : undefined
  }));
}

export async function createPlan(projectId: string, name: string): Promise<PlanRow> {
  const res = await apiFetch<Ok<PlanRow>>(`/api/projects/${projectId}/plans`, {
    method: "POST",
    body: { name }
  });
  return { ...res.data, id: String(res.data.id) };
}

export async function updatePlan(projectId: string, planId: string, name: string): Promise<PlanRow> {
  const res = await apiFetch<Ok<PlanRow>>(`/api/projects/${projectId}/plans/${planId}`, {
    method: "PATCH",
    body: { name }
  });
  return { ...res.data, id: String(res.data.id) };
}

export async function deletePlan(projectId: string, planId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/plans/${planId}`, { method: "DELETE" });
}

export async function createPlanEntry(
  projectId: string,
  planId: string,
  input: { name: string; environment?: string }
): Promise<PlanEntryRow> {
  const res = await apiFetch<Ok<PlanEntryRow>>(`/api/projects/${projectId}/plans/${planId}/entries`, {
    method: "POST",
    body: input
  });
  return {
    ...res.data,
    id: String(res.data.id),
    runId: res.data.runId ? String(res.data.runId) : undefined
  };
}

export async function updatePlanEntry(
  projectId: string,
  planId: string,
  entryId: string,
  input: { name?: string; environment?: string | null }
): Promise<PlanEntryRow> {
  const res = await apiFetch<Ok<PlanEntryRow>>(`/api/projects/${projectId}/plans/${planId}/entries/${entryId}`, {
    method: "PATCH",
    body: input
  });
  return {
    ...res.data,
    id: String(res.data.id),
    runId: res.data.runId ? String(res.data.runId) : undefined
  };
}

export async function deletePlanEntry(projectId: string, planId: string, entryId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/plans/${planId}/entries/${entryId}`, { method: "DELETE" });
}

export async function createRunFromPlanEntry(
  projectId: string,
  planId: string,
  entryId?: string
): Promise<{ planId: string; entryId: string; runId: string }> {
  const res = await apiFetch<Ok<{ planId: string; entryId: string; runId: string }>>(
    `/api/projects/${projectId}/plans/${planId}/runs`,
    {
      method: "POST",
      body: entryId ? { entryId } : {}
    }
  );
  return {
    planId: String(res.data.planId),
    entryId: String(res.data.entryId),
    runId: String(res.data.runId)
  };
}

export async function fetchPlanMatrix(projectId: string, planId: string, entryId?: string): Promise<PlanMatrixResponse> {
  const res = await apiFetch<Ok<PlanMatrixResponse>>(`/api/projects/${projectId}/plans/${planId}/matrix`, {
    method: "POST",
    body: entryId ? { entryId } : {}
  });
  return {
    planId: String(res.data.planId),
    planName: res.data.planName,
    entryId: res.data.entryId ? String(res.data.entryId) : null,
    selectedConfigurationIds: (res.data.selectedConfigurationIds ?? []).map((id) => String(id)),
    groups: (res.data.groups ?? []).map((g) => ({
      id: String(g.id),
      name: g.name,
      displayOrder: g.displayOrder,
      configurations: (g.configurations ?? []).map((c) => ({
        id: String(c.id),
        name: c.name,
        displayOrder: c.displayOrder
      }))
    }))
  };
}

export async function createRunByConfiguration(input: {
  projectId: string;
  planId: string;
  entryId: string;
  configurationIds: string[];
}): Promise<{ planId: string; entryId: string; runId: string; configurationIds: string[] }> {
  const res = await apiFetch<Ok<{ planId: string; entryId: string; runId: string; configurationIds: string[] }>>(
    `/api/projects/${input.projectId}/plans/${input.planId}/runs/by-configuration`,
    {
      method: "POST",
      body: {
        entryId: input.entryId,
        configurationIds: input.configurationIds
      }
    }
  );
  return {
    planId: String(res.data.planId),
    entryId: String(res.data.entryId),
    runId: String(res.data.runId),
    configurationIds: (res.data.configurationIds ?? []).map((id) => String(id))
  };
}

export async function fetchPlanRollupByConfiguration(projectId: string, planId: string): Promise<PlanRollupRow[]> {
  const res = await apiFetch<Ok<{ items: PlanRollupRow[] }>>(`/api/projects/${projectId}/plans/${planId}/rollup-by-configuration`);
  return (res.data.items ?? []).map((item) => ({
    ...item,
    configurationId: String(item.configurationId),
    groupId: String(item.groupId)
  }));
}

export async function fetchPlanEntryConfigurations(
  projectId: string,
  planId: string,
  entryId: string
): Promise<PlanEntryConfigurationMapping> {
  const res = await apiFetch<Ok<PlanEntryConfigurationMapping>>(
    `/api/projects/${projectId}/plans/${planId}/entries/${entryId}/configurations`
  );
  return {
    entryId: String(res.data.entryId),
    configurationIds: (res.data.configurationIds ?? []).map((id) => String(id)),
    items: (res.data.items ?? []).map((item) => ({
      configurationId: String(item.configurationId),
      configurationName: item.configurationName,
      groupId: item.groupId == null ? null : String(item.groupId),
      groupName: item.groupName ?? null
    }))
  };
}
