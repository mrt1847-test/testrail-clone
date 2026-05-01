import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";

type TestStatus = "untested" | "passed" | "failed" | "blocked" | "retest";

export type CustomFieldRow = {
  id: string;
  name: string;
  systemName: string;
  fieldType: "text" | "number" | "select" | "boolean";
  scope: "case" | "result";
  options: string[];
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
};

export type CustomStatusRow = {
  id: string;
  name: string;
  systemName: string;
  canonicalStatus: TestStatus;
  color: string;
  isSystem: boolean;
  isActive: boolean;
  displayOrder: number;
};

export type CaseTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  fields: string[];
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
};

export type WebhookRow = {
  id: string;
  event: string;
  targetUrl: string;
  secretPrefix?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type WebhookAttemptRow = {
  id: string;
  webhookId: string;
  activityEventId: string | null;
  event: string;
  targetUrl: string;
  status: string;
  attemptNo: number;
  responseStatus: number | null;
  error: string | null;
  nextRetryAt: string | null;
  deliveredAt: string | null;
  signaturePrefix: string;
  createdAt: string;
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

export type AuditLogQuery = {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  createdFrom?: string;
  createdTo?: string;
  q?: string;
};

export type AuditLogResult = {
  items: AuditLogRow[];
  filters: string[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AuditLogFilterOptions = {
  actions: string[];
  entityTypes: string[];
};

export type DefectIntegrationSettings = {
  projectId: string;
  provider: string;
  isEnabled: boolean;
  issueUrlTemplate: string | null;
  defaultProjectKey: string | null;
};

export type ActivityEventRow = {
  id: string;
  projectId: string;
  actorUserId: string | null;
  actor: { id: string; email: string; name: string | null } | null;
  entityType: string;
  entityId: string;
  eventType: string;
  title: string;
  body: string | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

export type NotificationRow = {
  id: string;
  projectId: string;
  activityEventId: string | null;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  activity: { id: string; entityType: string; entityId: string; eventType: string } | null;
};

export type NotificationResult = {
  items: NotificationRow[];
  unreadCount: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type NotificationPreferences = {
  assignmentEnabled: boolean;
  failedResultEnabled: boolean;
  mentionEnabled: boolean;
  digestEnabled: boolean;
};

export async function fetchCustomFields(projectId: string, scope?: CustomFieldRow["scope"]): Promise<CustomFieldRow[]> {
  const suffix = scope ? `?scope=${scope}` : "";
  const res = await apiFetch<Paged<CustomFieldRow>>(`/api/projects/${projectId}/settings/custom-fields${suffix}`);
  return res.data.map((row) => ({
    ...row,
    id: String(row.id),
    scope: row.scope ?? "case",
    options: row.options ?? [],
    isRequired: row.isRequired ?? false,
    isActive: row.isActive ?? true,
    displayOrder: row.displayOrder ?? 0
  }));
}

export async function createCustomField(projectId: string, input: Omit<CustomFieldRow, "id">): Promise<CustomFieldRow> {
  const res = await apiFetch<Ok<CustomFieldRow>>(`/api/projects/${projectId}/settings/custom-fields`, {
    method: "POST",
    body: input
  });
  return {
    ...res.data,
    id: String(res.data.id),
    scope: res.data.scope ?? "case",
    options: res.data.options ?? []
  };
}

export async function updateCustomField(
  projectId: string,
  fieldId: string,
  input: Partial<Omit<CustomFieldRow, "id">>
): Promise<CustomFieldRow> {
  const res = await apiFetch<Ok<CustomFieldRow>>(`/api/projects/${projectId}/settings/custom-fields/${fieldId}`, {
    method: "PATCH",
    body: input
  });
  return {
    ...res.data,
    id: String(res.data.id),
    scope: res.data.scope ?? "case",
    options: res.data.options ?? []
  };
}

export async function deleteCustomField(projectId: string, fieldId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/settings/custom-fields/${fieldId}`, { method: "DELETE" });
}

export async function fetchCustomStatuses(projectId: string): Promise<CustomStatusRow[]> {
  const res = await apiFetch<Paged<CustomStatusRow>>(`/api/projects/${projectId}/settings/statuses`);
  return res.data.map((row) => ({
    ...row,
    id: String(row.id),
    isSystem: row.isSystem ?? false,
    isActive: row.isActive ?? true,
    displayOrder: row.displayOrder ?? 0
  }));
}

export async function createCustomStatus(
  projectId: string,
  input: Omit<CustomStatusRow, "id" | "isSystem">
): Promise<CustomStatusRow> {
  const res = await apiFetch<Ok<CustomStatusRow>>(`/api/projects/${projectId}/settings/statuses`, {
    method: "POST",
    body: input
  });
  return { ...res.data, id: String(res.data.id) };
}

export async function updateCustomStatus(
  projectId: string,
  statusId: string,
  input: Partial<Omit<CustomStatusRow, "id" | "isSystem">>
): Promise<CustomStatusRow> {
  const res = await apiFetch<Ok<CustomStatusRow>>(`/api/projects/${projectId}/settings/statuses/${statusId}`, {
    method: "PATCH",
    body: input
  });
  return { ...res.data, id: String(res.data.id) };
}

export async function deleteCustomStatus(projectId: string, statusId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/settings/statuses/${statusId}`, { method: "DELETE" });
}

export async function fetchCaseTemplates(projectId: string): Promise<CaseTemplateRow[]> {
  const res = await apiFetch<Paged<CaseTemplateRow>>(`/api/projects/${projectId}/settings/templates`);
  return res.data.map((row) => ({
    ...row,
    id: String(row.id),
    description: row.description ?? null,
    fields: row.fields ?? [],
    isDefault: row.isDefault ?? false,
    isActive: row.isActive ?? true,
    displayOrder: row.displayOrder ?? 0
  }));
}

export async function createCaseTemplate(projectId: string, input: Omit<CaseTemplateRow, "id">): Promise<CaseTemplateRow> {
  const res = await apiFetch<Ok<CaseTemplateRow>>(`/api/projects/${projectId}/settings/templates`, {
    method: "POST",
    body: input
  });
  return { ...res.data, id: String(res.data.id), fields: res.data.fields ?? [] };
}

export async function updateCaseTemplate(
  projectId: string,
  templateId: string,
  input: Partial<Omit<CaseTemplateRow, "id">>
): Promise<CaseTemplateRow> {
  const res = await apiFetch<Ok<CaseTemplateRow>>(`/api/projects/${projectId}/settings/templates/${templateId}`, {
    method: "PATCH",
    body: input
  });
  return { ...res.data, id: String(res.data.id), fields: res.data.fields ?? [] };
}

export async function deleteCaseTemplate(projectId: string, templateId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/settings/templates/${templateId}`, { method: "DELETE" });
}

export async function fetchWebhooks(projectId: string): Promise<WebhookRow[]> {
  const res = await apiFetch<Paged<WebhookRow>>(`/api/projects/${projectId}/settings/webhooks`);
  return res.data.map((row) => ({ ...row, id: String(row.id) }));
}

export async function fetchWebhookEvents(projectId: string): Promise<string[]> {
  const res = await apiFetch<Ok<{ events: string[] }>>(`/api/projects/${projectId}/settings/webhook-events`);
  return res.data.events;
}

export async function createWebhook(projectId: string, input: {
  event: string;
  targetUrl: string;
  secret?: string;
  isActive?: boolean;
}): Promise<WebhookRow> {
  const res = await apiFetch<Ok<WebhookRow>>(`/api/projects/${projectId}/settings/webhooks`, {
    method: "POST",
    body: input
  });
  return { ...res.data, id: String(res.data.id) };
}

export async function updateWebhook(
  projectId: string,
  webhookId: string,
  input: Partial<{ event: string; targetUrl: string; secret: string; isActive: boolean }>
): Promise<WebhookRow> {
  const res = await apiFetch<Ok<WebhookRow>>(`/api/projects/${projectId}/settings/webhooks/${webhookId}`, {
    method: "PATCH",
    body: input
  });
  return { ...res.data, id: String(res.data.id) };
}

export async function deleteWebhook(projectId: string, webhookId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/settings/webhooks/${webhookId}`, { method: "DELETE" });
}

export async function fetchWebhookAttempts(projectId: string): Promise<WebhookAttemptRow[]> {
  const res = await apiFetch<Paged<WebhookAttemptRow>>(`/api/projects/${projectId}/settings/webhook-attempts`);
  return res.data.map((row) => ({
    ...row,
    id: String(row.id),
    webhookId: String(row.webhookId),
    activityEventId: row.activityEventId ? String(row.activityEventId) : null
  }));
}

export async function retryWebhookAttempt(projectId: string, attemptId: string): Promise<WebhookAttemptRow> {
  const res = await apiFetch<Ok<WebhookAttemptRow>>(`/api/projects/${projectId}/settings/webhook-attempts/${attemptId}/retry`, {
    method: "POST"
  });
  return {
    ...res.data,
    id: String(res.data.id),
    webhookId: String(res.data.webhookId),
    activityEventId: res.data.activityEventId ? String(res.data.activityEventId) : null
  };
}

export async function fetchAuditLogs(projectId: string, query: AuditLogQuery = {}): Promise<AuditLogResult> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.action?.trim()) params.set("action", query.action.trim());
  if (query.entityType?.trim()) params.set("entityType", query.entityType.trim());
  if (query.entityId?.trim()) params.set("entityId", query.entityId.trim());
  if (query.actorUserId?.trim()) params.set("actorUserId", query.actorUserId.trim());
  if (query.createdFrom?.trim()) params.set("createdFrom", query.createdFrom.trim());
  if (query.createdTo?.trim()) params.set("createdTo", query.createdTo.trim());
  if (query.q?.trim()) params.set("q", query.q.trim());
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch<Ok<AuditLogResult>>(`/api/projects/${projectId}/settings/audit-logs${suffix}`);
  return {
    ...res.data,
    items: res.data.items.map((row) => ({
      ...row,
      id: String(row.id),
      actorUserId: row.actorUserId ? String(row.actorUserId) : null,
      entityId: String(row.entityId)
    }))
  };
}

export async function fetchAuditLogFilterOptions(projectId: string): Promise<AuditLogFilterOptions> {
  const res = await apiFetch<Ok<AuditLogFilterOptions>>(`/api/projects/${projectId}/settings/audit-log-filters`);
  return res.data;
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
  const res = await apiFetch<Ok<ProjectMemberRow>>(`/api/projects/${input.projectId}/settings/members/${input.memberId}`, {
    method: "PATCH",
    body: { role: input.role }
  });
  return { ...res.data, id: String(res.data.id), userId: String(res.data.userId) };
}

export async function removeProjectMember(projectId: string, memberId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/settings/members/${memberId}`, { method: "DELETE" });
}

export async function fetchDefectIntegrationSettings(projectId: string): Promise<DefectIntegrationSettings> {
  const res = await apiFetch<Ok<DefectIntegrationSettings>>(`/api/projects/${projectId}/integrations/defects`);
  return {
    projectId: String(res.data.projectId),
    provider: res.data.provider,
    isEnabled: res.data.isEnabled,
    issueUrlTemplate: res.data.issueUrlTemplate ?? null,
    defaultProjectKey: res.data.defaultProjectKey ?? null
  };
}

export async function updateDefectIntegrationSettings(input: {
  projectId: string;
  provider?: string;
  isEnabled?: boolean;
  issueUrlTemplate?: string | null;
  defaultProjectKey?: string | null;
}): Promise<DefectIntegrationSettings> {
  const res = await apiFetch<Ok<DefectIntegrationSettings>>(`/api/projects/${input.projectId}/integrations/defects`, {
    method: "PATCH",
    body: {
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.issueUrlTemplate !== undefined ? { issueUrlTemplate: input.issueUrlTemplate } : {}),
      ...(input.defaultProjectKey !== undefined ? { defaultProjectKey: input.defaultProjectKey } : {})
    }
  });
  return {
    projectId: String(res.data.projectId),
    provider: res.data.provider,
    isEnabled: res.data.isEnabled,
    issueUrlTemplate: res.data.issueUrlTemplate ?? null,
    defaultProjectKey: res.data.defaultProjectKey ?? null
  };
}

export async function fetchProjectActivity(projectId: string, page = 1, pageSize = 25) {
  const res = await apiFetch<Paged<ActivityEventRow>>(`/api/projects/${projectId}/activity?page=${page}&pageSize=${pageSize}`);
  return {
    ...res,
    data: res.data.map((row) => ({
      ...row,
      id: String(row.id),
      projectId: String(row.projectId),
      actorUserId: row.actorUserId ? String(row.actorUserId) : null,
      actor: row.actor ? { ...row.actor, id: String(row.actor.id) } : null,
      entityId: String(row.entityId)
    }))
  };
}

export async function fetchNotifications(projectId: string, page = 1, pageSize = 25): Promise<NotificationResult> {
  const res = await apiFetch<Paged<NotificationRow> & { unreadCount: number }>(
    `/api/projects/${projectId}/notifications?page=${page}&pageSize=${pageSize}`
  );
  return {
    ...res,
    items: res.data.map((row) => ({
      ...row,
      id: String(row.id),
      projectId: String(row.projectId),
      activityEventId: row.activityEventId ? String(row.activityEventId) : null,
      activity: row.activity ? { ...row.activity, id: String(row.activity.id), entityId: String(row.activity.entityId) } : null
    }))
  };
}

export async function markNotificationRead(projectId: string, notificationId: string) {
  await apiFetch<Ok<{ id: string; readAt: string }>>(`/api/projects/${projectId}/notifications/${notificationId}/read`, {
    method: "PATCH"
  });
}

export async function markAllNotificationsRead(projectId: string) {
  await apiFetch<Ok<{ updated: number }>>(`/api/projects/${projectId}/notifications/read-all`, { method: "POST" });
}

export async function fetchNotificationPreferences(projectId: string): Promise<NotificationPreferences> {
  const res = await apiFetch<Ok<NotificationPreferences>>(`/api/projects/${projectId}/notification-preferences`);
  return res.data;
}

export async function updateNotificationPreferences(
  projectId: string,
  input: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const res = await apiFetch<Ok<NotificationPreferences>>(`/api/projects/${projectId}/notification-preferences`, {
    method: "PATCH",
    body: input
  });
  return res.data;
}
