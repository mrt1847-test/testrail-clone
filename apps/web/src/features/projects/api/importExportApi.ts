import { API_BASE, apiFetch, getAccessToken } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";

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

export type CaseImportIssue = {
  row: number;
  field?: string;
  code: string;
  message: string;
};

export type CaseCsvFieldProfile = {
  key: string;
  label: string;
  required: boolean;
  description: string | null;
  aliases: string[];
};

export type CaseImportProfile = {
  coreFields: CaseCsvFieldProfile[];
  customFields: Array<{
    key: string;
    systemName: string;
    label: string;
    fieldType: string;
    required: boolean;
  }>;
  exportHeaders: string[];
};

export type CaseImportResult = {
  job: ImportExportJobRow;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    imported: number;
    phase?: string;
  };
  issues: CaseImportIssue[];
  columnMapping?: Record<string, string> | null;
};

export type ImportJobDetail = {
  job: ImportExportJobRow;
  summary: Record<string, unknown>;
  issues: CaseImportIssue[];
  resultReady: boolean;
};

export type ExportJobDetail = {
  job: ImportExportJobRow;
  summary: Record<string, unknown>;
  downloadUrl: string | null;
};

/** Match server `LARGE_IMPORT_BYTES` — use async import when CSV exceeds this size. */
export const LARGE_IMPORT_BYTES = 48_000;

export function shouldUseAsyncImport(csv: string) {
  return new TextEncoder().encode(csv).length >= LARGE_IMPORT_BYTES;
}

const CASE_CSV_MAPPING_STORAGE_PREFIX = "case-csv-mapping:";

export function caseCsvMappingStorageKey(projectId: string) {
  return `${CASE_CSV_MAPPING_STORAGE_PREFIX}${projectId}`;
}

export function loadSavedCaseCsvMapping(projectId: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(caseCsvMappingStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCaseCsvMapping(projectId: string, mapping: Record<string, string>) {
  localStorage.setItem(caseCsvMappingStorageKey(projectId), JSON.stringify(mapping));
}

export function clearSavedCaseCsvMapping(projectId: string) {
  localStorage.removeItem(caseCsvMappingStorageKey(projectId));
}

export async function fetchCaseImportProfile(projectId: string): Promise<CaseImportProfile> {
  const res = await apiFetch<Ok<CaseImportProfile>>(`/api/projects/${projectId}/cases/import/csv/profile`);
  return res.data;
}

export async function suggestCaseCsvMapping(
  projectId: string,
  input: { headers?: string[]; csv?: string }
): Promise<{ headers: string[]; mapping: Record<string, string>; mappingIssues: CaseImportIssue[] }> {
  const res = await apiFetch<
    Ok<{ headers: string[]; mapping: Record<string, string>; mappingIssues: CaseImportIssue[] }>
  >(`/api/projects/${projectId}/cases/import/csv/suggest-mapping`, {
    method: "POST",
    body: input
  });
  return res.data;
}

export async function importCasesCsvAsync(input: {
  projectId: string;
  csv: string;
  dryRun: boolean;
  atomic?: boolean;
  sectionId?: string;
  columnMapping?: Record<string, string>;
}): Promise<{ job: ImportExportJobRow; pollUrl: string }> {
  const res = await apiFetch<Ok<{ job: ImportExportJobRow; pollUrl: string }>>(
    `/api/projects/${input.projectId}/cases/import/csv/async`,
    {
      method: "POST",
      body: {
        csv: input.csv,
        dryRun: input.dryRun,
        atomic: input.atomic ?? true,
        ...(input.sectionId ? { sectionId: input.sectionId } : {}),
        ...(input.columnMapping ? { columnMapping: input.columnMapping } : {})
      }
    }
  );
  return {
    pollUrl: res.data.pollUrl,
    job: { ...res.data.job, id: String(res.data.job.id), projectId: String(res.data.job.projectId) }
  };
}

export async function fetchImportJob(projectId: string, jobId: string): Promise<ImportJobDetail> {
  const res = await apiFetch<Ok<ImportJobDetail>>(`/api/projects/${projectId}/import-jobs/${jobId}`);
  return {
    ...res.data,
    job: { ...res.data.job, id: String(res.data.job.id), projectId: String(res.data.job.projectId) }
  };
}

export async function fetchExportJob(projectId: string, jobId: string): Promise<ExportJobDetail> {
  const res = await apiFetch<Ok<ExportJobDetail>>(`/api/projects/${projectId}/export-jobs/${jobId}`);
  return {
    ...res.data,
    job: { ...res.data.job, id: String(res.data.job.id), projectId: String(res.data.job.projectId) }
  };
}

export async function requestCasesExportAsync(
  projectId: string,
  format: "csv" | "json" | "xml" = "csv"
): Promise<{ job: ImportExportJobRow; downloadUrl: string; pollUrl: string }> {
  const res = await apiFetch<
    Ok<{ job: ImportExportJobRow; downloadUrl: string; pollUrl: string }>
  >(`/api/projects/${projectId}/cases/export/async`, {
    method: "POST",
    body: { format }
  });
  return {
    downloadUrl: res.data.downloadUrl,
    pollUrl: res.data.pollUrl,
    job: { ...res.data.job, id: String(res.data.job.id), projectId: String(res.data.job.projectId) }
  };
}

export async function requestRunResultsExportAsync(
  projectId: string,
  runId: string
): Promise<{ job: ImportExportJobRow; downloadUrl: string; pollUrl: string }> {
  const res = await apiFetch<
    Ok<{ job: ImportExportJobRow; downloadUrl: string; pollUrl: string }>
  >(`/api/projects/${projectId}/runs/results/export/csv/async`, {
    method: "POST",
    body: { runId }
  });
  return {
    downloadUrl: res.data.downloadUrl,
    pollUrl: res.data.pollUrl,
    job: { ...res.data.job, id: String(res.data.job.id), projectId: String(res.data.job.projectId) }
  };
}

export async function importCasesCsv(input: {
  projectId: string;
  csv: string;
  dryRun: boolean;
  atomic?: boolean;
  sectionId?: string;
  columnMapping?: Record<string, string>;
  preferAsync?: boolean;
}): Promise<CaseImportResult> {
  if (input.preferAsync || shouldUseAsyncImport(input.csv)) {
    const queued = await importCasesCsvAsync(input);
    const detail = await pollImportJobUntilReady(input.projectId, queued.job.id);
    return {
      job: detail.job,
      summary: {
        totalRows: Number(detail.summary.totalRows ?? 0),
        validRows: Number(detail.summary.validRows ?? 0),
        invalidRows: Number(detail.summary.invalidRows ?? 0),
        imported: Number(detail.summary.imported ?? 0),
        phase: typeof detail.summary.phase === "string" ? detail.summary.phase : undefined
      },
      issues: detail.issues,
      columnMapping: input.columnMapping ?? null
    };
  }
  const res = await apiFetch<Ok<CaseImportResult>>(`/api/projects/${input.projectId}/cases/import/csv`, {
    method: "POST",
    body: {
      csv: input.csv,
      dryRun: input.dryRun,
      atomic: input.atomic ?? true,
      ...(input.sectionId ? { sectionId: input.sectionId } : {}),
      ...(input.columnMapping ? { columnMapping: input.columnMapping } : {})
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

export type StructuredCaseImportFormat = "json" | "xml";

export async function importCasesStructured(input: {
  projectId: string;
  format: StructuredCaseImportFormat;
  content: string;
  dryRun: boolean;
  atomic?: boolean;
  sectionId?: string;
}): Promise<CaseImportResult> {
  const res = await apiFetch<Ok<CaseImportResult>>(`/api/projects/${input.projectId}/cases/import/${input.format}`, {
    method: "POST",
    body: {
      content: input.content,
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

export async function fetchReportExportJobs(projectId: string): Promise<ImportExportJobRow[]> {
  const res = await apiFetch<Paged<ImportExportJobRow>>(
    `/api/projects/${projectId}/reports/export-jobs?page=1&pageSize=30`
  );
  return res.data.map((row) => ({ ...row, id: String(row.id), projectId: String(row.projectId) }));
}

export type ReportExportJobRequest = {
  reportType: string;
  format?: "csv";
  runId?: string;
  caseId?: string;
  testId?: string;
  status?: string;
  source?: string;
  createdFrom?: string;
  createdTo?: string;
  q?: string;
  maxRows?: number;
};

export async function requestReportExportJob(
  projectId: string,
  body: ReportExportJobRequest
): Promise<{ jobId: string; downloadPath: string }> {
  const res = await apiFetch<
    Ok<{
      job: { id: string | number };
      downloadUrl: string;
    }>
  >(`/api/projects/${projectId}/reports/export`, {
    method: "POST",
    body: { format: "csv", ...body }
  });
  const jobId = String(res.data.job.id);
  return {
    jobId,
    downloadPath: `/api/projects/${projectId}/export-jobs/${jobId}/download`
  };
}

export async function downloadExportJob(projectId: string, jobId: string, filename: string) {
  await downloadFile(`/api/projects/${projectId}/export-jobs/${jobId}/download`, filename);
}

const TERMINAL_IMPORT_STATUSES = new Set(["completed", "failed", "completed_with_errors"]);
const TERMINAL_EXPORT_STATUSES = new Set(["completed", "failed"]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollImportJobUntilReady(projectId: string, jobId: string, maxAttempts = 120) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const detail = await fetchImportJob(projectId, jobId);
    if (detail.resultReady && TERMINAL_IMPORT_STATUSES.has(detail.job.status)) {
      return detail;
    }
    if (detail.job.status === "failed") {
      return detail;
    }
    await sleep(1500);
  }
  throw new Error("Import job timed out while waiting for completion");
}

export async function pollExportJobUntilReady(projectId: string, jobId: string, maxAttempts = 120) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const detail = await fetchExportJob(projectId, jobId);
    if (TERMINAL_EXPORT_STATUSES.has(detail.job.status)) {
      return detail;
    }
    await sleep(1500);
  }
  throw new Error("Export job timed out while waiting for completion");
}

export async function downloadCsv(path: string, filename: string) {
  await downloadFile(path, filename);
}

export async function downloadFile(path: string, filename: string) {
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

export async function downloadCasesJson(projectId: string) {
  await downloadFile(`/api/projects/${projectId}/cases/export/json`, `project-${projectId}-cases.json`);
}

export async function downloadCasesXml(projectId: string) {
  await downloadFile(`/api/projects/${projectId}/cases/export/xml`, `project-${projectId}-cases.xml`);
}

export async function downloadRunResultsCsv(projectId: string, runId: string) {
  await downloadCsv(`/api/projects/${projectId}/runs/${runId}/results/export/csv`, `run-${runId}-results.csv`);
}

export type AttachmentImportResult = {
  job: ImportExportJobRow;
  summary: {
    total: number;
    imported: number;
    skipped: number;
    failed: number;
    withContent: number;
  };
  issues: Array<{ index: number; code: string; message: string }>;
};

export async function downloadAttachmentsExport(
  projectId: string,
  query?: { caseId?: string; runId?: string; includeContent?: boolean }
) {
  const params = new URLSearchParams();
  if (query?.caseId) params.set("caseId", query.caseId);
  if (query?.runId) params.set("runId", query.runId);
  if (query?.includeContent) params.set("includeContent", "true");
  params.set("includeDownloadUrls", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  await downloadFile(
    `/api/projects/${projectId}/attachments/export${suffix}`,
    `project-${projectId}-attachments.json`
  );
}

export async function requestAttachmentsExportAsync(
  projectId: string,
  input?: { caseId?: string; runId?: string; includeContent?: boolean }
) {
  const res = await apiFetch<
    Ok<{
      job: ImportExportJobRow;
      downloadUrl: string;
      pollUrl: string;
    }>
  >(`/api/projects/${projectId}/attachments/export/async`, {
    method: "POST",
    body: {
      caseId: input?.caseId,
      runId: input?.runId,
      includeContent: input?.includeContent ?? false,
      includeDownloadUrls: true
    }
  });
  return res.data;
}

export async function importAttachmentsManifest(input: {
  projectId: string;
  manifest: string;
  dryRun?: boolean;
  replaceExisting?: boolean;
}): Promise<AttachmentImportResult> {
  const res = await apiFetch<Ok<AttachmentImportResult>>(`/api/projects/${input.projectId}/attachments/import`, {
    method: "POST",
    body: {
      manifest: input.manifest,
      dryRun: input.dryRun,
      replaceExisting: input.replaceExisting
    }
  });
  return res.data;
}
