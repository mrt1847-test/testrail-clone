import { apiFetch } from "../../../shared/api/http";
import { uploadFileToPresignedUrl } from "../../../shared/api/upload";
import type { Ok, Paged } from "../../../shared/api/types";
import type {
  ResultAttachmentItem,
  ResultDefectLinkItem,
  RunDetailDto,
  RunSummary,
  TestResultHistoryItem,
  TestResultStepItem
} from "../types";

type ApiRun = {
  id: string;
  name: string;
  status: string;
  includeAll?: boolean;
  environment?: string | null;
  assignedTo?: string | null;
  milestoneId?: string | null;
  startedAt?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
  composition?: {
    compositionMode: "static" | "include_all_live" | "dynamic_filter";
    filterDefinition?: {
      priority?: "low" | "medium" | "high";
      state?: "active" | "archived";
      includedSectionIds?: string[];
    };
    lastSyncedAt?: string;
    lastSyncAdded?: number;
    lastSyncRemoved?: number;
  } | null;
};

type ApiInstance = {
  id: string;
  caseId: string;
  titleSnapshot: string;
  status: string;
  assignedTo?: string | null;
};

type RunDetailPayload = { run: ApiRun; instances: ApiInstance[] };
type RunHeaderPayload = { run: ApiRun };

type RunSummaryResponse = {
  runId: string;
  total: number;
  counts: Record<string, number>;
  completionRate: number;
};

export async function fetchRuns(projectId: string): Promise<RunSummary[]> {
  const res = await apiFetch<Paged<ApiRun>>(`/api/projects/${projectId}/runs?page=1&pageSize=100`);
  return res.data.map((r) => ({
    id: String(r.id),
    name: r.name,
    status: r.status === "closed" ? "closed" : "open",
    progress: 0,
    failed: 0,
    createdAt: "—",
    milestoneId: r.milestoneId ? String(r.milestoneId) : null,
    assignedTo: r.assignedTo ? String(r.assignedTo) : null
  }));
}

export async function fetchRunDetail(projectId: string, runId: string): Promise<RunDetailDto | null> {
  try {
    const [detailRes, summaryRes] = await Promise.all([
      apiFetch<Ok<RunHeaderPayload>>(`/api/projects/${projectId}/runs/${runId}?includeInstances=false`),
      apiFetch<RunSummaryResponse>(`/api/runs/${runId}/summary`)
    ]);
    const { run } = detailRes.data;
    const counts = summaryRes.counts ?? {};
    const passed = counts.passed ?? 0;
    const failed = counts.failed ?? 0;
    const blocked = counts.blocked ?? 0;
    const retest = counts.retest ?? 0;
    const untested = counts.untested ?? 0;
    const progress = Math.round((summaryRes.completionRate ?? 0) * 100);

    return {
      run: {
        id: String(run.id),
        name: run.name,
        status: run.status === "closed" ? "closed" : "open",
        environment: run.environment ?? undefined,
        milestoneId: run.milestoneId ? String(run.milestoneId) : null,
        assignedTo: run.assignedTo ? String(run.assignedTo) : null,
        includeAll: run.includeAll,
        composition: run.composition ?? null,
        startedAt: run.startedAt ?? null,
        closedAt: run.closedAt ?? null,
        progress,
        failed,
        createdAt: run.createdAt ?? "—"
      },
      instances: [],
      counts: { passed, failed, blocked, retest, untested }
    };
  } catch {
    return null;
  }
}

export async function fetchRunInstancesPage(input: {
  projectId: string;
  runId: string;
  page: number;
  pageSize: number;
  status?: string;
  assignee?: string;
  search?: string;
}): Promise<Paged<ApiInstance>> {
  const params = new URLSearchParams();
  params.set("page", String(input.page));
  params.set("pageSize", String(input.pageSize));
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.assignee && input.assignee !== "all") params.set("assignedTo", input.assignee);
  if (input.assignee === "") params.set("assignedTo", "null");
  if (input.search?.trim()) params.set("q", input.search.trim());
  return apiFetch<Paged<ApiInstance>>(`/api/projects/${input.projectId}/runs/${input.runId}/instances?${params.toString()}`);
}

export async function addRunResult(input: {
  runId: string;
  testId: string;
  status: "passed" | "failed" | "blocked" | "retest" | "untested";
  comment?: string;
  elapsed?: string;
  version?: string;
  defects?: string[];
  customValues?: Record<string, string | number | boolean | null>;
  stepResults?: Array<{ stepOrder: number; status: "passed" | "failed" | "blocked" | "retest" | "untested"; actualResult?: string; comment?: string }>;
}) {
  return apiFetch(`/api/runs/${input.runId}/results`, {
    method: "POST",
    body: {
      testId: input.testId,
      status: input.status,
      comment: input.comment,
      elapsed: input.elapsed,
      version: input.version,
      defects: input.defects,
      customValues: input.customValues,
      stepResults: input.stepResults
    }
  });
}

export type BulkRunResultItem = {
  index: number;
  caseId: string;
  status: "saved" | "failed";
  testId?: string;
  resultId?: string;
  errorCode?: string;
  message?: string;
};

export type BulkRunResultsResponse = {
  runId: string;
  atomic: boolean;
  total: number;
  saved: number;
  failed: number;
  items: BulkRunResultItem[];
};

export async function bulkAddRunResults(input: {
  runId: string;
  atomic?: boolean;
  results: Array<{
    caseId: string;
    status: "passed" | "failed" | "blocked" | "retest" | "untested";
    comment?: string;
    elapsed?: string;
    version?: string;
    defects?: string[];
    customValues?: Record<string, string | number | boolean | null>;
  }>;
}): Promise<BulkRunResultsResponse> {
  const res = await apiFetch<BulkRunResultsResponse>(`/api/runs/${input.runId}/results/bulk`, {
    method: "POST",
    body: {
      atomic: input.atomic ?? false,
      results: input.results
    }
  });
  return {
    ...res,
    runId: String(res.runId),
    items: res.items.map((item) => ({
      ...item,
      caseId: String(item.caseId),
      testId: item.testId != null ? String(item.testId) : undefined,
      resultId: item.resultId != null ? String(item.resultId) : undefined
    }))
  };
}

export async function closeRun(runId: string) {
  return apiFetch(`/api/runs/${runId}/close`, { method: "POST" });
}

export async function updateRunAssignee(runId: string, assignedTo: string | null) {
  return apiFetch(`/api/runs/${runId}`, {
    method: "PATCH",
    body: { assignedTo }
  });
}

export async function rerunRun(runId: string, statuses: Array<"passed" | "failed" | "blocked" | "retest" | "untested">) {
  return apiFetch(`/api/runs/${runId}/rerun`, {
    method: "POST",
    body: { statuses }
  });
}

export async function updateTestAssignee(testId: string, assignedTo: string | null) {
  return apiFetch(`/api/tests/${testId}/assignee`, {
    method: "PATCH",
    body: { assignedTo }
  });
}

export async function fetchRunTestSubscriptions(runId: string): Promise<string[]> {
  const res = await apiFetch<Ok<{ testIds: string[] }>>(`/api/runs/${runId}/test-subscriptions`);
  return (res.data.testIds ?? []).map(String);
}

export async function updateTestSubscription(testId: string, subscribed: boolean) {
  return apiFetch<Ok<{ testId: string; subscribed: boolean }>>(`/api/tests/${testId}/subscription`, {
    method: "PUT",
    body: { subscribed }
  });
}

export type AssignedTestRow = {
  testId: string;
  runId: string;
  runName: string;
  caseId: string;
  title: string;
  status: string;
  assignedTo: string | null;
};

export async function fetchAssignedToMe(projectId: string): Promise<AssignedTestRow[]> {
  const res = await apiFetch<Ok<{ items: AssignedTestRow[] }>>(`/api/projects/${projectId}/tests/assigned-to-me`);
  return (res.data.items ?? []).map((row) => ({
    ...row,
    testId: String(row.testId),
    runId: String(row.runId),
    caseId: String(row.caseId),
    assignedTo: row.assignedTo ? String(row.assignedTo) : null
  }));
}

export type CreateRunInput = {
  projectId: string;
  suiteId: string;
  name: string;
  includeAll: boolean;
  caseIds?: string[];
  excludedCaseIds?: string[];
  includedSectionIds?: string[];
  excludedSectionIds?: string[];
  milestoneId?: string | null;
  environment?: string;
  compositionMode?: "static" | "include_all_live" | "dynamic_filter";
  filterDefinition?: {
    priority?: "low" | "medium" | "high";
    state?: "active" | "archived";
    includedSectionIds?: string[];
  };
};

export type UpdateRunCompositionInput = {
  filterDefinition?: {
    priority?: "low" | "medium" | "high";
    state?: "active" | "archived";
    includedSectionIds?: string[];
  };
  filterSelectionMode?: "set" | "add" | "remove";
  sync?: boolean;
};

export async function updateRunComposition(projectId: string, runId: string, input: UpdateRunCompositionInput) {
  const res = await apiFetch<
    Ok<{
      run: ApiRun;
      sync: { skipped: boolean; added: number; removed: number; reason?: string } | null;
    }>
  >(`/api/projects/${projectId}/runs/${runId}/composition`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
  return res.data;
}

export async function syncRunComposition(projectId: string, runId: string) {
  const res = await apiFetch<
    Ok<{
      runId: string;
      skipped: boolean;
      added: number;
      removed: number;
      reason?: string;
    }>
  >(`/api/projects/${projectId}/runs/${runId}/sync-composition`, { method: "POST" });
  return res.data;
}

export async function createRun(input: CreateRunInput): Promise<RunSummary> {
  const created = await apiFetch<{ run: ApiRun; instances: ApiInstance[] }>(`/api/projects/${input.projectId}/runs`, {
    method: "POST",
    body: {
      suiteId: input.suiteId,
      name: input.name,
      includeAll: input.includeAll,
      caseIds: input.caseIds,
      excludedCaseIds: input.excludedCaseIds,
      includedSectionIds: input.includedSectionIds,
      excludedSectionIds: input.excludedSectionIds,
      milestoneId: input.milestoneId ?? undefined,
      environment: input.environment,
      compositionMode: input.compositionMode,
      filterDefinition: input.filterDefinition
    }
  });
  return {
    id: String(created.run.id),
    name: created.run.name,
    status: created.run.status === "closed" ? "closed" : "open",
    progress: 0,
    failed: 0,
    createdAt: "—",
    milestoneId: created.run.milestoneId ? String(created.run.milestoneId) : null,
    assignedTo: created.run.assignedTo ? String(created.run.assignedTo) : null
  };
}

type ApiResultHistory = {
  id: string;
  status: string;
  comment?: string;
  elapsed?: string;
  version?: string;
  source: "manual" | "automation" | "api";
  defects?: string[];
  customValues?: Record<string, string | number | boolean | null>;
  createdAt: string;
};

function mapApiResultHistory(row: ApiResultHistory): TestResultHistoryItem {
  return {
    id: String(row.id),
    status: row.status,
    comment: row.comment,
    elapsed: row.elapsed,
    version: row.version,
    source: row.source,
    defects: row.defects ?? [],
    customValues: row.customValues ?? {},
    createdAt: row.createdAt
  };
}

export async function fetchTestResultsPage(
  testId: string,
  page: number,
  pageSize: number
): Promise<{
  items: TestResultHistoryItem[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
}> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const res = await apiFetch<
    Ok<{
      items: ApiResultHistory[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    }>
  >(`/api/tests/${testId}/results?${params}`);
  const d = res.data;
  return {
    items: d.items.map(mapApiResultHistory),
    total: d.total,
    totalPages: d.totalPages,
    page: d.page,
    pageSize: d.pageSize
  };
}

export async function reopenRun(runId: string) {
  return apiFetch<Ok<ApiRun>>(`/api/runs/${runId}/reopen`, { method: "POST" });
}

export async function addCasesToRun(runId: string, caseIds: string[]) {
  return apiFetch<Ok<{ run: ApiRun; added: ApiInstance[]; skipped: number }>>(`/api/runs/${runId}/tests`, {
    method: "POST",
    body: { caseIds }
  });
}

export async function removeTestFromRun(runId: string, testId: string, confirmDataLoss?: boolean) {
  return apiFetch<Ok<{ removed: boolean; hadResults: boolean; caseId: string; titleSnapshot: string }>>(
    `/api/runs/${runId}/remove-test`,
    {
      method: "POST",
      body: { testId, confirmDataLoss }
    }
  );
}

type ApiResultStep = {
  id: string;
  resultId: string;
  stepOrder: number;
  status: string;
  actualResult?: string;
  comment?: string;
  createdAt: string;
};

export async function fetchResultSteps(resultId: string): Promise<TestResultStepItem[]> {
  const rows = await apiFetch<ApiResultStep[]>(`/api/results/${resultId}/steps`);
  return rows.map((row) => ({
    id: String(row.id),
    resultId: String(row.resultId),
    stepOrder: row.stepOrder,
    status: row.status,
    actualResult: row.actualResult,
    comment: row.comment,
    createdAt: row.createdAt
  }));
}

type ApiResultAttachment = {
  id: string;
  fileName: string;
  contentType?: string | null;
  storagePath: string;
  fileSize?: string | null;
  createdAt: string;
};

export async function fetchResultAttachments(resultId: string): Promise<ResultAttachmentItem[]> {
  const rows = await apiFetch<ApiResultAttachment[]>(`/api/results/${resultId}/attachments`);
  return rows.map((row) => ({
    id: String(row.id),
    fileName: row.fileName,
    contentType: row.contentType ?? null,
    storagePath: row.storagePath,
    fileSize: row.fileSize ? String(row.fileSize) : null,
    createdAt: row.createdAt
  }));
}

export async function addResultAttachment(
  resultId: string,
  input: { fileName: string; contentType?: string; storagePath?: string; fileSize?: string }
) {
  return apiFetch(`/api/results/${resultId}/attachments`, {
    method: "POST",
    body: {
      fileName: input.fileName,
      contentType: input.contentType,
      storagePath: input.storagePath,
      fileSize: input.fileSize
    }
  });
}

type PresignAttachmentResponse = {
  data: {
    storagePath: string;
    uploadUrl: string;
    method: "PUT" | "POST";
    headers?: Record<string, string>;
    expiresAt: string;
  };
};

export async function uploadResultAttachmentViaPresign(
  resultId: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  const presign = await apiFetch<PresignAttachmentResponse>(`/api/results/${resultId}/attachments/presign`, {
    method: "POST",
    body: {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileSize: String(file.size)
    }
  });
  await uploadFileToPresignedUrl(file, presign.data, {
    contentType: file.type || "application/octet-stream",
    onProgress
  });

  return apiFetch(`/api/attachments`, {
    method: "POST",
    body: {
      resultId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      storagePath: presign.data.storagePath,
      fileSize: String(file.size)
    }
  });
}

type AttachmentDownloadUrlResponse = {
  data: {
    attachmentId: string;
    downloadUrl: string;
    expiresAt: string;
  };
};

export async function fetchAttachmentDownloadUrl(attachmentId: string): Promise<string> {
  const res = await apiFetch<AttachmentDownloadUrlResponse>(`/api/attachments/${attachmentId}/download-url`, {
    method: "POST"
  });
  return res.data.downloadUrl;
}

export async function deleteAttachment(attachmentId: string) {
  return apiFetch(`/api/attachments/${attachmentId}`, {
    method: "DELETE"
  });
}

type ApiResultDefectLink = {
  id: string;
  defectKey: string;
  url?: string | null;
  createdAt: string;
};

export async function fetchResultDefectLinks(resultId: string): Promise<ResultDefectLinkItem[]> {
  const rows = await apiFetch<ApiResultDefectLink[]>(`/api/results/${resultId}/defects`);
  return rows.map((row) => ({
    id: String(row.id),
    defectKey: row.defectKey,
    url: row.url ?? null,
    createdAt: row.createdAt
  }));
}

export async function addResultDefectLink(resultId: string, input: { defectKey: string; url?: string }) {
  return apiFetch(`/api/results/${resultId}/defects`, {
    method: "POST",
    body: {
      defectKey: input.defectKey,
      url: input.url
    }
  });
}

export async function deleteResultDefectLink(resultId: string, defectLinkId: string) {
  return apiFetch(`/api/results/${resultId}/defects/${defectLinkId}`, {
    method: "DELETE"
  });
}

export async function pushResultDefect(
  resultId: string,
  input: { defectKey?: string; title?: string; description?: string; provider?: string }
) {
  const res = await apiFetch<
    Ok<{
      id: string;
      provider: string;
      defectKey: string;
      url?: string | null;
      title?: string | null;
      description?: string | null;
    }>
  >(`/api/results/${resultId}/defects/push`, {
    method: "POST",
    body: {
      defectKey: input.defectKey,
      title: input.title,
      description: input.description,
      provider: input.provider
    }
  });
  return {
    id: String(res.data.id),
    provider: res.data.provider,
    defectKey: res.data.defectKey,
    url: res.data.url ?? null,
    title: res.data.title ?? null,
    description: res.data.description ?? null
  };
}

export type ResultExplorerRow = {
  id: string;
  runId: string;
  runName: string;
  testId: string;
  caseId: string;
  title: string;
  refs?: string | null;
  status: string;
  source: string;
  createdAt: string;
  comment?: string | null;
  customValues?: Record<string, string | number | boolean | null>;
};

export async function fetchProjectResultExplorer(input: {
  projectId: string;
  page: number;
  pageSize: number;
  runId?: string;
  caseId?: string;
  testId?: string;
  status?: string;
  source?: string;
  createdFrom?: string;
  createdTo?: string;
  q?: string;
  customFilters?: Record<string, string>;
}): Promise<{ items: ResultExplorerRow[]; page: number; pageSize: number; total: number; totalPages: number }> {
  const params = new URLSearchParams();
  params.set("page", String(input.page));
  params.set("pageSize", String(input.pageSize));
  if (input.runId?.trim()) params.set("runId", input.runId.trim());
  if (input.caseId?.trim()) params.set("caseId", input.caseId.trim());
  if (input.testId?.trim()) params.set("testId", input.testId.trim());
  if (input.status?.trim() && input.status !== "all") params.set("status", input.status);
  if (input.source?.trim() && input.source !== "all") params.set("source", input.source);
  if (input.createdFrom?.trim()) params.set("createdFrom", input.createdFrom.trim());
  if (input.createdTo?.trim()) params.set("createdTo", input.createdTo.trim());
  if (input.q?.trim()) params.set("q", input.q.trim());
  for (const [systemName, value] of Object.entries(input.customFilters ?? {})) {
    if (value.trim()) params.set(`custom_${systemName}`, value.trim());
  }
  const res = await apiFetch<
    Ok<{ items: ResultExplorerRow[]; page: number; pageSize: number; total: number; totalPages: number }>
  >(`/api/projects/${input.projectId}/reports/results-explorer?${params.toString()}`);
  return {
    ...res.data,
    items: (res.data.items ?? []).map((row) => ({
      ...row,
      id: String(row.id),
      runId: String(row.runId),
      testId: String(row.testId),
      caseId: String(row.caseId)
    }))
  };
}
