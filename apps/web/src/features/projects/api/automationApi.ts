import { API_BASE } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import { apiFetch } from "../../../shared/api/http";

type TestStatus = "untested" | "passed" | "failed" | "blocked" | "retest";

export type AutomationSummary = {
  mappedCases: number;
  uploadedRuns: number;
  lastUploadAt: string | null;
  totalCases: number;
  unmappedCases: number;
  coveragePercent: number;
  pendingRetryCount: number;
};

export type AutomationMappingRow = {
  caseId: string;
  title: string;
  automationKey: string | null;
};

export type AutomationRetryQueueRow = {
  uploadId: string;
  uploadedAt: string;
  total: number;
  saved: number;
  failed: number;
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
    errorCode?: string | null;
    guidance?: string | null;
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
    customValues?: Record<string, string | number | boolean | null>;
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

export async function fetchAutomationSummary(projectId: string): Promise<AutomationSummary> {
  const res = await apiFetch<Ok<AutomationSummary>>(`/api/projects/${projectId}/automation/summary`);
  const data = res.data;
  return {
    ...data,
    totalCases: data.totalCases ?? data.mappedCases,
    unmappedCases: data.unmappedCases ?? 0,
    coveragePercent: data.coveragePercent ?? 0,
    pendingRetryCount: data.pendingRetryCount ?? 0
  };
}

export async function fetchAutomationMappings(
  projectId: string,
  params: { coverage?: "mapped" | "unmapped" | "all"; q?: string; page?: number; pageSize?: number } = {}
): Promise<{ rows: AutomationMappingRow[]; total: number }> {
  const search = new URLSearchParams();
  if (params.coverage) search.set("coverage", params.coverage);
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  const query = search.toString();
  const res = await apiFetch<Paged<AutomationMappingRow>>(
    `/api/projects/${projectId}/automation/mappings${query ? `?${query}` : ""}`
  );
  return {
    rows: res.data.map((row) => ({
      caseId: String(row.caseId),
      title: row.title,
      automationKey: row.automationKey ?? null
    })),
    total: res.total
  };
}

export async function updateAutomationMapping(
  projectId: string,
  caseId: string,
  automationKey: string
): Promise<AutomationMappingRow> {
  const res = await apiFetch<Ok<AutomationMappingRow>>(
    `/api/projects/${projectId}/automation/mappings/${caseId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ automationKey })
    }
  );
  return {
    caseId: String(res.data.caseId),
    title: res.data.title,
    automationKey: res.data.automationKey ?? null
  };
}

export async function fetchAutomationRetryQueue(projectId: string): Promise<AutomationRetryQueueRow[]> {
  const res = await apiFetch<Ok<AutomationRetryQueueRow[]>>(`/api/projects/${projectId}/automation/retry-queue`);
  return res.data.map((row) => ({
    ...row,
    uploadId: String(row.uploadId)
  }));
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
      comment: item.comment ?? null,
      errorCode: item.errorCode ?? null,
      guidance: item.guidance ?? null
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
      customValues: item.customValues,
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
