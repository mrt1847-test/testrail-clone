import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";

export type AutomationSummary = {
  mappedCases: number;
  uploadedRuns: number;
  lastUploadAt: string | null;
};

export type AutomationUploadRow = {
  id: string;
  uploadedAt: string;
  total: number;
  saved: number;
  failed: number;
};

export type AutomationUploadDetail = {
  id: string;
  uploadedAt: string;
  total: number;
  saved: number;
  failed: number;
  items: Array<{
    resultId: string;
    testId: string;
    caseId: string;
    status: string;
    comment?: string | null;
  }>;
  metadata: Record<string, string | number | null>;
};

export type TokenRow = {
  id: string;
  name: string;
  lastUsedAt: string | null;
};

export type MilestoneRow = {
  id: string;
  name: string;
  isCompleted: boolean;
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

export type CustomFieldRow = {
  id: string;
  name: string;
  fieldType: "text" | "number" | "select";
};

export type WebhookRow = {
  id: string;
  event: string;
  targetUrl: string;
  isActive: boolean;
};

export type ProjectMemberRow = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: "owner" | "manager" | "tester" | "viewer";
};

export type AuditLogRow = {
  id: string;
  action: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
  createdAt: string;
};

export async function fetchAutomationSummary(projectId: string): Promise<AutomationSummary> {
  const res = await apiFetch<Ok<AutomationSummary>>(`/api/projects/${projectId}/automation/summary`);
  return res.data;
}

export async function fetchAutomationUploads(projectId: string): Promise<AutomationUploadRow[]> {
  const res = await apiFetch<Paged<AutomationUploadRow>>(`/api/projects/${projectId}/automation/uploads`);
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function fetchAutomationUploadDetail(projectId: string, uploadId: string): Promise<AutomationUploadDetail> {
  const res = await apiFetch<Ok<AutomationUploadDetail>>(`/api/projects/${projectId}/automation/uploads/${uploadId}`);
  return {
    ...res.data,
    id: String(res.data.id),
    items: (res.data.items ?? []).map((item) => ({
      resultId: String(item.resultId),
      testId: String(item.testId),
      caseId: String(item.caseId),
      status: item.status,
      comment: item.comment ?? null
    }))
  };
}

export async function retryAutomationUploadFailed(projectId: string, uploadId: string) {
  return apiFetch<Ok<{ uploadId: string; queued: number; retried: number }>>(
    `/api/projects/${projectId}/automation/uploads/${uploadId}/retry-failed`,
    { method: "POST" }
  );
}

export async function fetchTokens(projectId: string): Promise<TokenRow[]> {
  const res = await apiFetch<Paged<TokenRow>>(`/api/projects/${projectId}/tokens`);
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function createToken(projectId: string, name: string) {
  const res = await apiFetch<{ data: TokenRow; rawToken: string }>(`/api/projects/${projectId}/tokens`, {
    method: "POST",
    body: { name }
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

export async function fetchMilestone(projectId: string, milestoneId: string): Promise<MilestoneRow> {
  const res = await apiFetch<Ok<MilestoneRow>>(`/api/projects/${projectId}/milestones/${milestoneId}`);
  return { ...res.data, id: String(res.data.id) };
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

export async function fetchCustomFields(projectId: string): Promise<CustomFieldRow[]> {
  const res = await apiFetch<Paged<CustomFieldRow>>(`/api/projects/${projectId}/settings/custom-fields`);
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function fetchWebhooks(projectId: string): Promise<WebhookRow[]> {
  const res = await apiFetch<Paged<WebhookRow>>(`/api/projects/${projectId}/settings/webhooks`);
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function fetchAuditLogs(projectId: string): Promise<AuditLogRow[]> {
  const res = await apiFetch<Ok<{ items: AuditLogRow[] }>>(`/api/projects/${projectId}/settings/audit-logs`);
  return res.data.items.map((row) => ({
    ...row,
    id: String(row.id),
    actorUserId: row.actorUserId ? String(row.actorUserId) : null,
    entityId: String(row.entityId)
  }));
}

export async function fetchProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const res = await apiFetch<Paged<ProjectMemberRow>>(`/api/projects/${projectId}/settings/members`);
  return res.data.map((row) => ({ ...row, id: String(row.id), userId: String(row.userId) }));
}

export async function addProjectMember(input: {
  projectId: string;
  email: string;
  name?: string;
  role: ProjectMemberRow["role"];
}) {
  const res = await apiFetch<Ok<ProjectMemberRow>>(`/api/projects/${input.projectId}/settings/members`, {
    method: "POST",
    body: { email: input.email, name: input.name, role: input.role }
  });
  return { ...res.data, id: String(res.data.id), userId: String(res.data.userId) };
}

export async function updateProjectMemberRole(input: {
  projectId: string;
  memberId: string;
  role: ProjectMemberRow["role"];
}) {
  const res = await apiFetch<Ok<ProjectMemberRow>>(
    `/api/projects/${input.projectId}/settings/members/${input.memberId}`,
    {
      method: "PATCH",
      body: { role: input.role }
    }
  );
  return { ...res.data, id: String(res.data.id), userId: String(res.data.userId) };
}

export async function removeProjectMember(projectId: string, memberId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/settings/members/${memberId}`, { method: "DELETE" });
}
