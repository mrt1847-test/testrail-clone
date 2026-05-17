import { API_BASE, apiFetch, getAccessToken } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";

export type PrintDocument = {
  entityType: "case" | "run" | "plan" | "milestone";
  title: string;
  subtitle?: string;
  generatedAt: string;
  meta: Array<{ label: string; value: string }>;
  tables: Array<{ title: string; columns: string[]; rows: string[][] }>;
  notes?: string[];
};

export async function fetchCasePrintDocument(caseId: string) {
  const res = await apiFetch<Ok<PrintDocument>>(`/api/cases/${caseId}/print`);
  return res.data;
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
