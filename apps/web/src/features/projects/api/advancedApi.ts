import { API_BASE, apiFetch, getAccessToken } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";

type TestStatus = "untested" | "passed" | "failed" | "blocked" | "retest";

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
  ciProvider?: string | null;
  branch?: string | null;
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
  metadata: {
    external_run_id: string | null;
    ci_provider: string | null;
    ci_build_id: string | null;
    job_url: string | null;
    commit_sha: string | null;
    branch: string | null;
    attempt: number | null;
  };
};

export type AutomationBulkUploadInput = {
  runId: string;
  token: string;
  atomic?: boolean;
  results: Array<{
    caseId: string;
    status: TestStatus;
    comment?: string;
    elapsed?: string;
    version?: string;
    defects?: string[];
    stepResults?: Array<{
      stepOrder: number;
      status: TestStatus;
      actualResult?: string;
      comment?: string;
    }>;
  }>;
  metadata?: {
    externalRunId?: string;
    ciProvider?: string;
    ciBuildId?: string;
    jobUrl?: string;
    commitSha?: string;
    branch?: string;
    attempt?: number;
  };
};

export type AutomationBulkUploadResponse = {
  runId: string;
  atomic: boolean;
  total: number;
  saved: number;
  failed: number;
  items: Array<
    | { index: number; caseId: string; status: "saved"; testId: string; resultId: string }
    | { index: number; caseId: string; status: "failed"; errorCode: string; message: string }
  >;
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

export type DefectIntegrationSettings = {
  projectId: string;
  provider: string;
  isEnabled: boolean;
  issueUrlTemplate: string | null;
  defaultProjectKey: string | null;
};

export type ImportExportJobRow = {
  id: string;
  projectId: string;
  type: string;
  status: string;
  dryRun?: boolean;
  summary?: Record<string, unknown> | null;
  errors?: unknown;
  filters?: Record<string, unknown> | null;
  createdAt: string;
};

export type CaseImportResult = {
  job: ImportExportJobRow;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    imported: number;
  };
  issues: Array<{
    row: number;
    field?: string;
    code: string;
    message: string;
  }>;
};

export async function fetchAutomationSummary(projectId: string): Promise<AutomationSummary> {
  const res = await apiFetch<Ok<AutomationSummary>>(`/api/projects/${projectId}/automation/summary`);
  return res.data;
}

export async function fetchAutomationUploads(projectId: string): Promise<AutomationUploadRow[]> {
  const res = await apiFetch<Paged<AutomationUploadRow>>(`/api/projects/${projectId}/automation/uploads`);
  return res.data.map((row) => ({
    ...row,
    id: String(row.id),
    ciProvider: row.ciProvider ?? null,
    branch: row.branch ?? null
  }));
}

export async function fetchAutomationUploadDetail(projectId: string, uploadId: string): Promise<AutomationUploadDetail> {
  const res = await apiFetch<Ok<AutomationUploadDetail>>(`/api/projects/${projectId}/automation/uploads/${uploadId}`);
  const metadata = res.data.metadata ?? {
    external_run_id: null,
    ci_provider: null,
    ci_build_id: null,
    job_url: null,
    commit_sha: null,
    branch: null,
    attempt: null
  };
  return {
    ...res.data,
    id: String(res.data.id),
    items: (res.data.items ?? []).map((item) => ({
      resultId: String(item.resultId),
      testId: String(item.testId),
      caseId: String(item.caseId),
      status: item.status,
      comment: item.comment ?? null
    })),
    metadata: {
      external_run_id: metadata.external_run_id ?? null,
      ci_provider: metadata.ci_provider ?? null,
      ci_build_id: metadata.ci_build_id ?? null,
      job_url: metadata.job_url ?? null,
      commit_sha: metadata.commit_sha ?? null,
      branch: metadata.branch ?? null,
      attempt: metadata.attempt ?? null
    }
  };
}

export async function retryAutomationUploadFailed(projectId: string, uploadId: string) {
  return apiFetch<Ok<{ uploadId: string; queued: number; retried: number }>>(
    `/api/projects/${projectId}/automation/uploads/${uploadId}/retry-failed`,
    { method: "POST" }
  );
}

export async function uploadAutomationResults(input: AutomationBulkUploadInput): Promise<AutomationBulkUploadResponse> {
  const payload = {
    runId: input.runId,
    atomic: input.atomic ?? false,
    ...(input.metadata
      ? {
          external_run_id: input.metadata.externalRunId,
          ci_provider: input.metadata.ciProvider,
          ci_build_id: input.metadata.ciBuildId,
          job_url: input.metadata.jobUrl,
          commit_sha: input.metadata.commitSha,
          branch: input.metadata.branch,
          attempt: input.metadata.attempt
        }
      : {}),
    results: input.results.map((item) => ({
      caseId: item.caseId,
      status: item.status,
      comment: item.comment,
      elapsed: item.elapsed,
      version: item.version,
      defects: item.defects,
      stepResults: item.stepResults
    }))
  };
  const res = await fetch(`${API_BASE}/api/automation/results/bulk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text();
    let parsed:
      | {
          error?: {
            code?: string;
            message?: string;
            details?: { issues?: Array<{ index?: number; caseId?: string; code?: string; message?: string }> };
          };
        }
      | undefined;
    try {
      parsed = JSON.parse(text) as {
        error?: {
          code?: string;
          message?: string;
          details?: { issues?: Array<{ index?: number; caseId?: string; code?: string; message?: string }> };
        };
      };
    } catch {
      parsed = undefined;
    }
    if (parsed) {
      const message = parsed.error?.message ?? res.statusText;
      const code = parsed.error?.code;
      const issuePreview = (parsed.error?.details?.issues ?? [])
        .slice(0, 3)
        .map((issue) => `#${issue.index ?? "?"} C${issue.caseId ?? "?"} ${issue.message ?? issue.code ?? "error"}`)
        .join(" | ");
      const fullMessage = issuePreview ? `${message} | ${issuePreview}` : message;
      throw new Error(code ? `${fullMessage} (${code})` : fullMessage);
    }
    if (text) throw new Error(text);
    throw new Error(res.statusText);
  }
  const data = (await res.json()) as {
    runId: string | number;
    atomic: boolean;
    total: number;
    saved: number;
    failed: number;
    items: Array<
      | { index: number; caseId: string | number; status: "saved"; testId: string | number; resultId: string | number }
      | { index: number; caseId: string | number; status: "failed"; errorCode: string; message: string }
    >;
  };
  return {
    runId: String(data.runId),
    atomic: data.atomic,
    total: data.total,
    saved: data.saved,
    failed: data.failed,
    items: data.items.map((item) =>
      item.status === "saved"
        ? {
            ...item,
            caseId: String(item.caseId),
            testId: String(item.testId),
            resultId: String(item.resultId)
          }
        : {
            ...item,
            caseId: String(item.caseId)
          }
    )
  };
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
  const res = await apiFetch<Ok<MilestoneRow>>(
    `/api/projects/${input.projectId}/milestones/${input.milestoneId}`,
    {
      method: "PATCH",
      body: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isCompleted !== undefined ? { isCompleted: input.isCompleted } : {})
      }
    }
  );
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

export async function fetchPlanMatrix(
  projectId: string,
  planId: string,
  entryId?: string
): Promise<PlanMatrixResponse> {
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

export async function fetchPlanRollupByConfiguration(
  projectId: string,
  planId: string
): Promise<PlanRollupRow[]> {
  const res = await apiFetch<Ok<{ items: PlanRollupRow[] }>>(
    `/api/projects/${projectId}/plans/${planId}/rollup-by-configuration`
  );
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

export async function importCasesCsv(input: {
  projectId: string;
  csv: string;
  dryRun: boolean;
  atomic?: boolean;
  sectionId?: string;
}): Promise<CaseImportResult> {
  const res = await apiFetch<Ok<CaseImportResult>>(`/api/projects/${input.projectId}/cases/import/csv`, {
    method: "POST",
    body: {
      csv: input.csv,
      dryRun: input.dryRun,
      atomic: input.atomic ?? true,
      ...(input.sectionId ? { sectionId: input.sectionId } : {})
    }
  });
  return {
    ...res.data,
    job: {
      ...res.data.job,
      id: String(res.data.job.id),
      projectId: String(res.data.job.projectId)
    }
  };
}

export async function fetchImportJobs(projectId: string): Promise<ImportExportJobRow[]> {
  const res = await apiFetch<Paged<ImportExportJobRow>>(`/api/projects/${projectId}/import-jobs?page=1&pageSize=20`);
  return res.data.map((row) => ({ ...row, id: String(row.id), projectId: String(row.projectId) }));
}

export async function fetchExportJobs(projectId: string): Promise<ImportExportJobRow[]> {
  const res = await apiFetch<Paged<ImportExportJobRow>>(`/api/projects/${projectId}/export-jobs?page=1&pageSize=20`);
  return res.data.map((row) => ({ ...row, id: String(row.id), projectId: String(row.projectId) }));
}

async function downloadCsv(path: string, filename: string) {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    throw new Error((await res.text()) || res.statusText);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadCasesCsv(projectId: string) {
  await downloadCsv(`/api/projects/${projectId}/cases/export/csv`, `project-${projectId}-cases.csv`);
}

export async function downloadRunResultsCsv(projectId: string, runId: string) {
  await downloadCsv(`/api/projects/${projectId}/runs/${runId}/results/export/csv`, `run-${runId}-results.csv`);
}
