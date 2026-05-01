import { API_BASE, apiFetch, getAccessToken } from "../../../shared/api/http";
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
        progress,
        failed,
        createdAt: "—"
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
  milestoneId?: string | null;
  environment?: string;
};

export async function createRun(input: CreateRunInput): Promise<RunSummary> {
  const created = await apiFetch<{ run: ApiRun; instances: ApiInstance[] }>(`/api/projects/${input.projectId}/runs`, {
    method: "POST",
    body: {
      suiteId: input.suiteId,
      name: input.name,
      includeAll: input.includeAll,
      caseIds: input.caseIds,
      milestoneId: input.milestoneId ?? undefined,
      environment: input.environment
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

export async function fetchTestResults(testId: string): Promise<TestResultHistoryItem[]> {
  const rows = await apiFetch<ApiResultHistory[]>(`/api/tests/${testId}/results`);
  return rows.map((row) => ({
    id: String(row.id),
    status: row.status,
    comment: row.comment,
    elapsed: row.elapsed,
    version: row.version,
    source: row.source,
    defects: row.defects ?? [],
    customValues: row.customValues ?? {},
    createdAt: row.createdAt
  }));
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

export async function uploadResultAttachmentViaPresign(resultId: string, file: File) {
  const presign = await apiFetch<PresignAttachmentResponse>(`/api/results/${resultId}/attachments/presign`, {
    method: "POST",
    body: {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileSize: String(file.size)
    }
  });
  const uploadHeaders: Record<string, string> = {
    ...(presign.data.headers ?? {}),
    "Content-Type": file.type || "application/octet-stream"
  };
  const accessToken = getAccessToken();
  if (accessToken && presign.data.uploadUrl.startsWith(API_BASE)) {
    uploadHeaders.Authorization = `Bearer ${accessToken}`;
  }
  const uploadRes = await fetch(presign.data.uploadUrl, {
    method: presign.data.method,
    headers: uploadHeaders,
    body: file
  });
  if (!uploadRes.ok) {
    throw new Error("attachment upload failed");
  }

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
