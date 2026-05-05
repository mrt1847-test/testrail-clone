import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import type { CaseListFilters, CasePriority, CaseType, CaseVersion, SectionNode, TestCase } from "../types";

type ApiCase = {
  id: string;
  projectId?: string;
  sectionId: string;
  title: string;
  priority?: string;
  caseType?: string;
  estimate?: string | null;
  refs?: string | null;
  labels?: string[];
  automationKey?: string | null;
  externalId?: string | null;
  preconditions?: string | null;
  customValues?: Record<string, string | number | boolean | null>;
  lockVersion?: number;
  updatedAt?: string;
  archivedAt?: string | null;
};

type ApiCaseStep = {
  id: string;
  stepOrder: number;
  content: string;
  expectedResult?: string | null;
};

type ApiCaseDetail = ApiCase & {
  steps?: Array<ApiCaseStep | { stepOrder: number; content: string; expectedResult?: string | null }>;
};

type ApiSection = { id: string; name: string };

export type SectionsBundle = {
  suiteId: string;
  sections: SectionNode[];
};

function asNum(id: string): number {
  return Number(id);
}

function normalizePriority(p?: string): CasePriority {
  const x = (p ?? "medium").toLowerCase();
  if (x === "low") return "Low";
  if (x === "high") return "High";
  return "Medium";
}

function normalizeType(t?: string): CaseType {
  const x = (t ?? "functional").toLowerCase();
  if (x === "integration") return "Integration";
  if (x === "regression") return "Regression";
  return "Functional";
}

export function mapApiCaseToTestCase(row: ApiCase): TestCase {
  return {
    id: asNum(row.id),
    projectId: row.projectId ? asNum(row.projectId) : undefined,
    caseCode: `C${row.id}`,
    title: row.title,
    type: normalizeType(row.caseType),
    priority: normalizePriority(row.priority),
    automationStatus: row.automationKey ? "automated" : "manual",
    estimate: row.estimate?.trim() ? row.estimate : "-",
    references: row.refs ?? "",
    labels: row.labels ?? [],
    automationKey: row.automationKey ?? "",
    preconditions: row.preconditions ?? "",
    customValues: row.customValues ?? {},
    steps: [],
    sectionId: asNum(row.sectionId),
    lockVersion: row.lockVersion ?? 1,
    updatedAt: row.updatedAt ?? new Date(0).toISOString(),
    archivedAt: row.archivedAt ?? null
  };
}

function mapApiCaseDetailToTestCase(row: ApiCaseDetail): TestCase {
  const base = mapApiCaseToTestCase(row);
  if (!row.steps || row.steps.length === 0) {
    return { ...base, steps: [] };
  }

  return {
    ...base,
    steps: row.steps.map((step) => ({
      ...("id" in step && step.id != null ? { id: asNum(step.id), stepOrder: step.stepOrder } : { stepOrder: step.stepOrder }),
      description: step.content,
      expected: step.expectedResult ?? "-"
    }))
  };
}

export async function fetchSectionsForProject(projectId: string): Promise<SectionsBundle> {
  const suites = await apiFetch<Paged<{ id: string }>>(`/api/projects/${projectId}/suites?page=1&pageSize=50`);
  const first = suites.data[0];
  if (!first) return { suiteId: "", sections: [] };

  const sections = await apiFetch<Paged<ApiSection>>(`/api/suites/${first.id}/sections?page=1&pageSize=200`);
  return {
    suiteId: String(first.id),
    sections: sections.data.map((section) => ({ id: asNum(section.id), name: section.name }))
  };
}

export async function createSection(suiteId: string, name: string): Promise<SectionNode> {
  const res = await apiFetch<Ok<ApiSection>>(`/api/suites/${suiteId}/sections`, {
    method: "POST",
    body: { name }
  });
  return { id: asNum(res.data.id), name: res.data.name };
}

export async function updateSection(sectionId: number, name: string): Promise<SectionNode> {
  const res = await apiFetch<Ok<ApiSection>>(`/api/sections/${sectionId}`, {
    method: "PATCH",
    body: { name }
  });
  return { id: asNum(res.data.id), name: res.data.name };
}

export async function deleteSection(sectionId: number): Promise<void> {
  await apiFetch<void>(`/api/sections/${sectionId}`, { method: "DELETE" });
}

export async function fetchCasesForSection(
  projectId: string,
  sectionId: number,
  filters: CaseListFilters,
  page = 1,
  pageSize = 100
): Promise<TestCase[]> {
  const params = new URLSearchParams({
    sectionId: String(sectionId),
    page: String(page),
    pageSize: String(pageSize)
  });
  if (filters.q.trim().length > 0) params.set("q", filters.q.trim());
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.caseType) params.set("caseType", filters.caseType);
  if (filters.automation) params.set("automation", filters.automation);
  if (filters.state === "archived") params.set("state", filters.state);

  const res = await apiFetch<Paged<ApiCase>>(`/api/projects/${projectId}/cases?${params.toString()}`);
  return res.data.map(mapApiCaseToTestCase);
}

export async function fetchCaseById(caseId: number): Promise<TestCase> {
  const res = await apiFetch<Ok<ApiCaseDetail>>(`/api/cases/${caseId}`);
  return mapApiCaseDetailToTestCase(res.data);
}

export async function createCase(
  sectionId: number,
  input: {
    title: string;
    priority?: string;
    caseType?: string;
    preconditions?: string;
    customValues?: Record<string, string | number | boolean | null>;
  }
): Promise<TestCase> {
  const res = await apiFetch<Ok<ApiCase>>(`/api/sections/${sectionId}/cases`, {
    method: "POST",
    body: input
  });
  return mapApiCaseToTestCase(res.data);
}

export async function updateCase(
  caseId: number,
  patch: {
    title?: string;
    preconditions?: string | null;
    priority?: string;
    caseType?: string;
    expectedUpdatedAt?: string;
    expectedVersion?: number;
    customValues?: Record<string, string | number | boolean | null>;
  }
): Promise<TestCase> {
  const res = await apiFetch<Ok<ApiCase>>(`/api/cases/${caseId}`, {
    method: "PATCH",
    body: patch
  });
  return mapApiCaseToTestCase(res.data);
}

export async function deleteCase(caseId: number): Promise<void> {
  await apiFetch<void>(`/api/cases/${caseId}`, { method: "DELETE" });
}

export type BulkDeleteCasesResult = {
  requested: number;
  deleted: number;
  failed: number;
  items: Array<{ caseId: string; success: boolean; error: string | null }>;
};

export async function bulkDeleteCases(projectId: string, caseIds: number[]): Promise<BulkDeleteCasesResult> {
  const res = await apiFetch<Ok<BulkDeleteCasesResult>>(`/api/projects/${projectId}/cases/bulk-delete`, {
    method: "POST",
    body: { caseIds }
  });
  return res.data;
}

export type BulkMoveCasesResult = {
  requested: number;
  moved: number;
  failed: number;
  targetSectionId: string;
  items: Array<{ caseId: string; success: boolean; error: string | null }>;
};

export async function bulkMoveCases(
  projectId: string,
  caseIds: number[],
  targetSectionId: number
): Promise<BulkMoveCasesResult> {
  const res = await apiFetch<Ok<BulkMoveCasesResult>>(`/api/projects/${projectId}/cases/bulk-move`, {
    method: "POST",
    body: { caseIds, targetSectionId }
  });
  return res.data;
}

export type BulkUpdateCasesResult = {
  requested: number;
  updated: number;
  failed: number;
  patch: { priority?: string; caseType?: string };
  items: Array<{ caseId: string; success: boolean; error: string | null }>;
};

export async function bulkUpdateCases(
  projectId: string,
  caseIds: number[],
  patch: { priority?: string; caseType?: string }
): Promise<BulkUpdateCasesResult> {
  const res = await apiFetch<Ok<BulkUpdateCasesResult>>(`/api/projects/${projectId}/cases/bulk-update`, {
    method: "POST",
    body: { caseIds, patch }
  });
  return res.data;
}

export type BulkArchiveCasesResult = {
  requested: number;
  changed: number;
  failed: number;
  archived: boolean;
  items: Array<{ caseId: string; success: boolean; error: string | null }>;
};

export async function bulkArchiveCases(
  projectId: string,
  caseIds: number[],
  archived: boolean
): Promise<BulkArchiveCasesResult> {
  const res = await apiFetch<Ok<BulkArchiveCasesResult>>(`/api/projects/${projectId}/cases/bulk-archive`, {
    method: "POST",
    body: { caseIds, archived }
  });
  return res.data;
}

export async function createCaseStep(
  caseId: number,
  input: { content: string; expectedResult?: string | null }
): Promise<void> {
  await apiFetch<Ok<{ id: string; stepOrder: number; content: string; expectedResult?: string | null }>>(
    `/api/cases/${caseId}/steps`,
    {
      method: "POST",
      body: input
    }
  );
}

export async function updateCaseStep(
  stepId: number,
  patch: { content?: string; expectedResult?: string | null; stepOrder?: number }
): Promise<void> {
  await apiFetch<Ok<{ id: string; stepOrder: number; content: string; expectedResult?: string | null }>>(
    `/api/case-steps/${stepId}`,
    {
      method: "PATCH",
      body: patch
    }
  );
}

export async function deleteCaseStep(stepId: number): Promise<void> {
  await apiFetch<void>(`/api/case-steps/${stepId}`, { method: "DELETE" });
}

type ApiCaseVersion = {
  id: string;
  caseId: string;
  versionNo: number;
  title: string;
  priority?: string | null;
  caseType?: string | null;
  preconditions?: string | null;
  customValuesSnapshot?: Record<string, string | number | boolean | null>;
  stepsSnapshot?: Array<{ stepOrder: number; content: string; expectedResult?: string | null }>;
  changeReason?: string | null;
  createdAt: string;
};

function mapApiCaseVersion(row: ApiCaseVersion): CaseVersion {
  return {
    id: asNum(row.id),
    caseId: asNum(row.caseId),
    versionNo: row.versionNo,
    title: row.title,
    priority: row.priority ?? null,
    caseType: row.caseType ?? null,
    preconditions: row.preconditions ?? null,
    customValuesSnapshot: row.customValuesSnapshot ?? {},
    stepsSnapshot: row.stepsSnapshot ?? [],
    changeReason: row.changeReason ?? null,
    createdAt: row.createdAt
  };
}

export async function fetchCaseVersions(caseId: number): Promise<CaseVersion[]> {
  const res = await apiFetch<Paged<ApiCaseVersion>>(`/api/cases/${caseId}/versions?page=1&pageSize=20`);
  return res.data.map(mapApiCaseVersion);
}

export async function fetchCaseVersion(caseId: number, versionId: number): Promise<CaseVersion> {
  const res = await apiFetch<Ok<ApiCaseVersion>>(`/api/cases/${caseId}/versions/${versionId}`);
  return mapApiCaseVersion(res.data);
}

export async function restoreCaseVersion(
  caseId: number,
  versionId: number,
  expectedVersion?: number
): Promise<TestCase> {
  const res = await apiFetch<Ok<ApiCaseDetail>>(`/api/cases/${caseId}/versions/${versionId}/restore`, {
    method: "POST",
    body: {
      ...(expectedVersion !== undefined ? { expectedVersion } : {})
    }
  });
  return mapApiCaseDetailToTestCase(res.data);
}
