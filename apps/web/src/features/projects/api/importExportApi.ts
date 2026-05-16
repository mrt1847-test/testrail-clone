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
  await downloadCsv(`/api/projects/${projectId}/export-jobs/${jobId}/download`, filename);
}

export async function downloadCsv(path: string, filename: string) {
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
