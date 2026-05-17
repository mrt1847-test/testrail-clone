import { API_BASE, apiFetch, getAccessToken } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type PrintDocumentSection = {
  entityType: "case" | "cases" | "run" | "plan" | "milestone" | "report";
  title: string;
  subtitle?: string;
  meta: Array<{ label: string; value: string }>;
  tables: Array<{ title: string; columns: string[]; rows: string[][] }>;
  notes?: string[];
};

export type PrintDocument = {
  entityType: "case" | "cases" | "run" | "plan" | "milestone" | "report";
  title: string;
  subtitle?: string;
  generatedAt: string;
  meta: Array<{ label: string; value: string }>;
  tables: Array<{ title: string; columns: string[]; rows: string[][] }>;
  notes?: string[];
  sections?: PrintDocumentSection[];
};

export async function fetchCasePrintDocument(caseId: string) {
  const res = await apiFetch<Ok<PrintDocument>>(`/api/cases/${caseId}/print`);
  return res.data;
}

export async function fetchCasesPrintDocument(projectId: string, caseIds: string[]) {
  const res = await apiFetch<Ok<PrintDocument>>(`/api/projects/${projectId}/cases/print`, {
    method: "POST",
    body: JSON.stringify({ caseIds }),
    headers: { "content-type": "application/json" }
  });
  return res.data;
}

export function buildCasesPrintPath(projectId: string, caseIds: Array<string | number>) {
  const ids = caseIds.map(String).join(",");
  return `/projects/${projectId}/cases/print?ids=${encodeURIComponent(ids)}`;
}

export function buildRunPrintPath(projectId: string, runId: string) {
  return `/projects/${projectId}/runs/${runId}/print`;
}

export function buildPlanPrintPath(projectId: string, planId: string) {
  return `/projects/${projectId}/plans/${planId}/print`;
}

export function buildMilestonePrintPath(projectId: string, milestoneId: string) {
  return `/projects/${projectId}/milestones/${milestoneId}/print`;
}

export async function fetchRunPrintDocument(projectId: string, runId: string) {
  const res = await apiFetch<Ok<PrintDocument>>(`/api/projects/${projectId}/runs/${runId}/print`);
  return res.data;
}

export async function fetchPlanPrintDocument(projectId: string, planId: string) {
  const res = await apiFetch<Ok<PrintDocument>>(`/api/projects/${projectId}/plans/${planId}/print`);
  return res.data;
}

export async function fetchMilestonePrintDocument(projectId: string, milestoneId: string) {
  const res = await apiFetch<Ok<PrintDocument>>(
    `/api/projects/${projectId}/milestones/${milestoneId}/print`
  );
  return res.data;
}

export async function downloadPrintHtml(apiPath: string, filename: string) {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const separator = apiPath.includes("?") ? "&" : "?";
  const res = await fetch(`${API_BASE}${apiPath}${separator}format=html`, { headers });
  if (!res.ok) {
    throw new Error((await res.text()) || res.statusText);
  }
  const blob = new Blob([await res.text()], { type: "text/html;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
