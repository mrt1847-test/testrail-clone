import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import { downloadCsv } from "./importExportApi";

type TestStatus = "untested" | "passed" | "failed" | "blocked" | "retest";

export type ProjectRole = "owner" | "manager" | "tester" | "viewer";

export type CustomFieldVisibilityRules = {
  viewRoles?: ProjectRole[];
  editRoles?: ProjectRole[];
  templateIds?: string[];
};

export type CustomFieldAccess = {
  canView: boolean;
  canEdit: boolean;
};

export type CustomFieldRow = {
  id: string;
  name: string;
  systemName: string;
  fieldType:
    | "string"
    | "text"
    | "url"
    | "integer"
    | "number"
    | "checkbox"
    | "boolean"
    | "date"
    | "dropdown"
    | "select"
    | "multi_select"
    | "user"
    | "milestone"
    | "rating";
  scope: "case" | "result";
  options: string[];
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  visibility?: CustomFieldVisibilityRules;
  access?: CustomFieldAccess;
};

export type CustomStatusRow = {
  id: string;
  name: string;
  systemName: string;
  canonicalStatus: TestStatus;
  color: string;
  isFinal: boolean;
  isUntested: boolean;
  isSystem: boolean;
  isActive: boolean;
  displayOrder: number;
};

export type CaseTemplateRow = {
  id: string;
  systemKey: string | null;
  name: string;
  description: string | null;
  fields: string[];
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
};

export type WebhookRow = {
  id: string;
  scope?: "project" | "global";
  event: string;
  targetUrl: string;
  secretPrefix?: string;
  isActive: boolean;
  consecutiveFailures?: number;
  disabledAt?: string | null;
  lastFailureAt?: string | null;
  autoDisabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type EmailOutboxRow = {
  id: string;
  userId: string;
  recipientEmail: string;
  kind: string;
  subject: string;
  bodyPreview: string;
  status: string;
  attemptNo: number;
  nextRetryAt: string | null;
  sentAt: string | null;
  error: string | null;
  notificationIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type EmailOutboxQuery = {
  page?: number;
  pageSize?: number;
  status?: "pending" | "sent" | "failed";
  kind?: "immediate" | "digest";
  recipientEmail?: string;
};

export type EmailOutboxResult = {
  items: EmailOutboxRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DigestPreview = {
  bodyText: string;
  notificationCount: number;
  recipientEmail: string | null;
  digestEnabled?: boolean;
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
  customRoleId?: string | null;
  customRoleName?: string | null;
};

export type CustomRoleRow = {
  id: string;
  projectId: string;
  name: string;
  systemName: string;
  permissions: string[];
  isActive: boolean;
};

export type AuditLogRow = {
  id: string;
  projectId?: string | null;
  projectName?: string | null;
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
  scope?: "project" | "all";
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  actorEmail?: string;
  actionExact?: boolean;
  entityTypeExact?: boolean;
  changesContains?: string;
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

export type DefectCreateMode = "url_template" | "provider_api";

export type DefectIntegrationSettings = {
  projectId: string;
  provider: string;
  isEnabled: boolean;
  createMode: DefectCreateMode;
  issueUrlTemplate: string | null;
  defaultProjectKey: string | null;
  apiBaseUrl: string | null;
  hasApiToken: boolean;
};

export type DefectTemplatePreview = {
  provider: string;
  createMode: DefectCreateMode;
  sampleIssueKey: string;
  url: string | null;
  providerLabel: string;
  fieldHints: string[];
};

export type DefectIntegrationCheck = {
  code: string;
  status: "pass" | "fail" | "warn";
  message: string;
};

export type DefectIntegrationConnectionTestResult = {
  ok: boolean;
  provider: string;
  checks: DefectIntegrationCheck[];
  sampleUrls: Array<{ key: string; url: string | null }>;
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
  activity: {
    id: string;
    entityType: string;
    entityId: string;
    eventType: string;
    title?: string;
    body?: string | null;
    payload?: Record<string, unknown> | null;
    createdAt?: string;
  } | null;
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
  activityEnabled: boolean;
  mentionEnabled: boolean;
  digestEnabled: boolean;
};

function mapCustomFieldRow(row: CustomFieldRow): CustomFieldRow {
  return {
    ...row,
    id: String(row.id),
    scope: row.scope ?? "case",
    options: row.options ?? [],
    isRequired: row.isRequired ?? false,
    isActive: row.isActive ?? true,
    displayOrder: row.displayOrder ?? 0,
    visibility: row.visibility ?? {}
  };
}

export async function fetchCustomFields(projectId: string, scope?: CustomFieldRow["scope"]): Promise<CustomFieldRow[]> {
  const suffix = scope ? `?scope=${scope}` : "";
  const res = await apiFetch<Paged<CustomFieldRow>>(`/api/projects/${projectId}/settings/custom-fields${suffix}`);
  return res.data.map(mapCustomFieldRow);
}

export async function fetchCustomFieldsForUse(
  projectId: string,
  scope: CustomFieldRow["scope"],
  templateId?: string | null
): Promise<CustomFieldRow[]> {
  const params = new URLSearchParams({ scope, forUse: "true" });
  if (templateId) params.set("templateId", templateId);
  const res = await apiFetch<Paged<CustomFieldRow>>(
    `/api/projects/${projectId}/settings/custom-fields?${params.toString()}`
  );
  return res.data.map(mapCustomFieldRow);
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
    systemKey: row.systemKey ?? null,
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
  scope?: "project" | "global";
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
  input: Partial<{ scope: "project" | "global"; event: string; targetUrl: string; secret: string; isActive: boolean }>
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

export async function testSendWebhook(
  projectId: string,
  webhookId: string
): Promise<{ ok: boolean; status?: number; bodyPreview?: string; error?: string; attemptId: string }> {
  const res = await apiFetch<
    Ok<{ ok: boolean; status?: number; bodyPreview?: string; error?: string; attemptId: string }>
  >(`/api/projects/${projectId}/settings/webhooks/${webhookId}/test-send`, { method: "POST" });
  return res.data;
}

export async function fetchAuditLogs(projectId: string, query: AuditLogQuery = {}): Promise<AuditLogResult> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.scope) params.set("scope", query.scope);
  if (query.action?.trim()) params.set("action", query.action.trim());
  if (query.entityType?.trim()) params.set("entityType", query.entityType.trim());
  if (query.entityId?.trim()) params.set("entityId", query.entityId.trim());
  if (query.actorUserId?.trim()) params.set("actorUserId", query.actorUserId.trim());
  if (query.actorEmail?.trim()) params.set("actorEmail", query.actorEmail.trim());
  if (query.actionExact) params.set("actionExact", "true");
  if (query.entityTypeExact) params.set("entityTypeExact", "true");
  if (query.changesContains?.trim()) params.set("changesContains", query.changesContains.trim());
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
      projectId: row.projectId ? String(row.projectId) : null,
      actorUserId: row.actorUserId ? String(row.actorUserId) : null,
      entityId: String(row.entityId)
    }))
  };
}

export async function fetchAuditLogFilterOptions(
  projectId: string,
  scope: AuditLogQuery["scope"] = "project"
): Promise<AuditLogFilterOptions> {
  const suffix = scope === "all" ? "?scope=all" : "";
  const res = await apiFetch<Ok<AuditLogFilterOptions>>(`/api/projects/${projectId}/settings/audit-log-filters${suffix}`);
  return res.data;
}

function auditQueryParams(query: AuditLogQuery = {}) {
  const params = new URLSearchParams();
  if (query.action?.trim()) params.set("action", query.action.trim());
  if (query.scope) params.set("scope", query.scope);
  if (query.entityType?.trim()) params.set("entityType", query.entityType.trim());
  if (query.entityId?.trim()) params.set("entityId", query.entityId.trim());
  if (query.actorUserId?.trim()) params.set("actorUserId", query.actorUserId.trim());
  if (query.actorEmail?.trim()) params.set("actorEmail", query.actorEmail.trim());
  if (query.actionExact) params.set("actionExact", "true");
  if (query.entityTypeExact) params.set("entityTypeExact", "true");
  if (query.changesContains?.trim()) params.set("changesContains", query.changesContains.trim());
  if (query.createdFrom?.trim()) params.set("createdFrom", query.createdFrom.trim());
  if (query.createdTo?.trim()) params.set("createdTo", query.createdTo.trim());
  if (query.q?.trim()) params.set("q", query.q.trim());
  return params;
}

export async function downloadAuditLogsCsv(projectId: string, query: AuditLogQuery = {}) {
  const params = auditQueryParams(query);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  await downloadCsv(
    `/api/projects/${projectId}/settings/audit-logs/export.csv${suffix}`,
    `${query.scope === "all" ? "all-projects" : `project-${projectId}`}-audit-logs.csv`
  );
}

export async function pruneAuditLogs(projectId: string, olderThanDays: number): Promise<{ deleted: number; cutoff: string | null }> {
  const res = await apiFetch<Ok<{ deleted: number; cutoff: string | null }>>(
    `/api/projects/${projectId}/settings/audit-logs/retention-prune`,
    {
      method: "POST",
      body: { olderThanDays }
    }
  );
  return res.data;
}

export async function fetchEmailOutbox(projectId: string, query: EmailOutboxQuery = {}): Promise<EmailOutboxResult> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  if (query.kind) params.set("kind", query.kind);
  if (query.recipientEmail?.trim()) params.set("recipientEmail", query.recipientEmail.trim());
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch<Ok<EmailOutboxResult>>(`/api/projects/${projectId}/settings/email-outbox${suffix}`);
  return {
    ...res.data,
    items: res.data.items.map((row) => ({
      ...row,
      id: String(row.id),
      userId: String(row.userId)
    }))
  };
}

export async function retryEmailOutbox(projectId: string, outboxId: string): Promise<EmailOutboxRow> {
  const res = await apiFetch<Ok<EmailOutboxRow>>(
    `/api/projects/${projectId}/settings/email-outbox/${outboxId}/retry`,
    { method: "POST" }
  );
  return { ...res.data, id: String(res.data.id), userId: String(res.data.userId) };
}

export async function fetchDigestPreview(projectId: string): Promise<DigestPreview> {
  const res = await apiFetch<Ok<DigestPreview>>(`/api/projects/${projectId}/settings/email-outbox/digest-preview`);
  return res.data;
}

export async function fetchProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  const res = await apiFetch<Paged<ProjectMemberRow>>(`/api/projects/${projectId}/settings/members`);
  return res.data.map((row) => ({ ...row, id: String(row.id), userId: String(row.userId) }));
}

export async function fetchCustomRoles(projectId: string): Promise<CustomRoleRow[]> {
  const res = await apiFetch<Paged<CustomRoleRow>>(`/api/projects/${projectId}/settings/custom-roles`);
  return res.data.map((row) => ({ ...row, id: String(row.id), projectId: String(row.projectId) }));
}

export async function createCustomRole(
  projectId: string,
  input: { name: string; systemName?: string; permissions: string[]; isActive?: boolean }
) {
  const res = await apiFetch<Ok<CustomRoleRow>>(`/api/projects/${projectId}/settings/custom-roles`, {
    method: "POST",
    body: input
  });
  return { ...res.data, id: String(res.data.id), projectId: String(res.data.projectId) };
}

export async function deleteCustomRole(projectId: string, roleId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/settings/custom-roles/${roleId}`, { method: "DELETE" });
}

export async function addProjectMember(input: {
  projectId: string;
  email: string;
  name?: string;
  role: ProjectMemberRow["role"];
  customRoleId?: string | null;
}) {
  const res = await apiFetch<Ok<ProjectMemberRow>>(`/api/projects/${input.projectId}/settings/members`, {
    method: "POST",
    body: { email: input.email, name: input.name, role: input.role, customRoleId: input.customRoleId ?? null }
  });
  return { ...res.data, id: String(res.data.id), userId: String(res.data.userId) };
}

export async function updateProjectMemberRole(input: {
  projectId: string;
  memberId: string;
  role?: ProjectMemberRow["role"];
  customRoleId?: string | null;
}) {
  const res = await apiFetch<Ok<ProjectMemberRow>>(`/api/projects/${input.projectId}/settings/members/${input.memberId}`, {
    method: "PATCH",
    body: { role: input.role, customRoleId: input.customRoleId }
  });
  return { ...res.data, id: String(res.data.id), userId: String(res.data.userId) };
}

export async function removeProjectMember(projectId: string, memberId: string) {
  await apiFetch<void>(`/api/projects/${projectId}/settings/members/${memberId}`, { method: "DELETE" });
}

function mapDefectIntegrationSettings(data: DefectIntegrationSettings): DefectIntegrationSettings {
  return {
    projectId: String(data.projectId),
    provider: data.provider,
    isEnabled: data.isEnabled,
    createMode: data.createMode === "provider_api" ? "provider_api" : "url_template",
    issueUrlTemplate: data.issueUrlTemplate ?? null,
    defaultProjectKey: data.defaultProjectKey ?? null,
    apiBaseUrl: data.apiBaseUrl ?? null,
    hasApiToken: data.hasApiToken ?? false
  };
}

export async function fetchDefectIntegrationSettings(projectId: string): Promise<DefectIntegrationSettings> {
  const res = await apiFetch<Ok<DefectIntegrationSettings>>(`/api/projects/${projectId}/integrations/defects`);
  return mapDefectIntegrationSettings(res.data);
}

export async function fetchDefectTemplatePreview(
  projectId: string,
  query: {
    provider?: string;
    createMode?: DefectCreateMode;
    issueUrlTemplate?: string | null;
    defaultProjectKey?: string | null;
    sampleIssueKey?: string;
  }
): Promise<DefectTemplatePreview> {
  const params = new URLSearchParams();
  if (query.provider) params.set("provider", query.provider);
  if (query.createMode) params.set("createMode", query.createMode);
  if (query.issueUrlTemplate) params.set("issueUrlTemplate", query.issueUrlTemplate);
  if (query.defaultProjectKey) params.set("defaultProjectKey", query.defaultProjectKey);
  if (query.sampleIssueKey) params.set("sampleIssueKey", query.sampleIssueKey);
  const res = await apiFetch<Ok<DefectTemplatePreview>>(
    `/api/projects/${projectId}/integrations/defects/template-preview?${params.toString()}`
  );
  return res.data;
}

export async function testDefectIntegrationConnection(input: {
  projectId: string;
  provider?: string;
  isEnabled?: boolean;
  createMode?: DefectCreateMode;
  issueUrlTemplate?: string | null;
  defaultProjectKey?: string | null;
  apiBaseUrl?: string | null;
  apiToken?: string | null;
  sampleIssueKey?: string;
}): Promise<DefectIntegrationConnectionTestResult> {
  const res = await apiFetch<Ok<DefectIntegrationConnectionTestResult>>(
    `/api/projects/${input.projectId}/integrations/defects/test-connection`,
    {
      method: "POST",
      body: {
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(input.createMode !== undefined ? { createMode: input.createMode } : {}),
        ...(input.issueUrlTemplate !== undefined ? { issueUrlTemplate: input.issueUrlTemplate } : {}),
        ...(input.defaultProjectKey !== undefined ? { defaultProjectKey: input.defaultProjectKey } : {}),
        ...(input.apiBaseUrl !== undefined ? { apiBaseUrl: input.apiBaseUrl } : {}),
        ...(input.apiToken !== undefined ? { apiToken: input.apiToken } : {}),
        ...(input.sampleIssueKey ? { sampleIssueKey: input.sampleIssueKey } : {})
      }
    }
  );
  return res.data;
}

export async function updateDefectIntegrationSettings(input: {
  projectId: string;
  provider?: string;
  isEnabled?: boolean;
  createMode?: DefectCreateMode;
  issueUrlTemplate?: string | null;
  defaultProjectKey?: string | null;
  apiBaseUrl?: string | null;
  apiToken?: string | null;
  clearApiToken?: boolean;
}): Promise<DefectIntegrationSettings> {
  const res = await apiFetch<Ok<DefectIntegrationSettings>>(`/api/projects/${input.projectId}/integrations/defects`, {
    method: "PATCH",
    body: {
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.createMode !== undefined ? { createMode: input.createMode } : {}),
      ...(input.issueUrlTemplate !== undefined ? { issueUrlTemplate: input.issueUrlTemplate } : {}),
      ...(input.defaultProjectKey !== undefined ? { defaultProjectKey: input.defaultProjectKey } : {}),
      ...(input.apiBaseUrl !== undefined ? { apiBaseUrl: input.apiBaseUrl } : {}),
      ...(input.apiToken !== undefined ? { apiToken: input.apiToken } : {}),
      ...(input.clearApiToken ? { clearApiToken: true } : {})
    }
  });
  return mapDefectIntegrationSettings(res.data);
}

export type ProjectActivityFilters = {
  entityType?: string;
  entityId?: string;
  eventType?: string;
  runId?: string;
  feed?: "history" | "all";
};

export async function fetchProjectActivity(
  projectId: string,
  page = 1,
  pageSize = 25,
  filters?: ProjectActivityFilters
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  if (filters?.entityType) params.set("entityType", filters.entityType);
  if (filters?.entityId) params.set("entityId", filters.entityId);
  if (filters?.eventType) params.set("eventType", filters.eventType);
  if (filters?.runId) params.set("runId", filters.runId);
  if (filters?.feed) params.set("feed", filters.feed);
  const res = await apiFetch<Paged<ActivityEventRow>>(`/api/projects/${projectId}/activity?${params.toString()}`);
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
