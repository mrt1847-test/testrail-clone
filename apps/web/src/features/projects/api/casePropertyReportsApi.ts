import { apiFetch } from "../../../shared/api/http";

export type CasePropertyField = {
  key: string;
  label: string;
  type: "system" | "custom";
};

export type CasePropertyDistributionItem = {
  value: string;
  label: string;
  count: number;
  percent: number;
};

export type CasePropertyDistributionReport = {
  selectedField: string;
  fields: CasePropertyField[];
  totalCases: number;
  items: CasePropertyDistributionItem[];
};

export type CaseStatusTopsReport = {
  totalTests: number;
  items: Array<{ status: string; count: number; percent: number }>;
};

type Ok<T> = { data: T };

export async function fetchCasePropertyDistribution(projectId: string, field: string) {
  const qs = new URLSearchParams({ field });
  const res = await apiFetch<Ok<CasePropertyDistributionReport>>(
    `/api/projects/${projectId}/reports/cases-property-distribution?${qs.toString()}`
  );
  return res.data;
}

export async function fetchStatusTops(projectId: string) {
  const res = await apiFetch<Ok<CaseStatusTopsReport>>(`/api/projects/${projectId}/reports/status-tops`);
  return res.data;
}
