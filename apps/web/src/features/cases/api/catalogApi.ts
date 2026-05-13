import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import type { CaseListFilters, CasePriority, CaseType, CaseVersion, SectionNode, TestCase } from "../types";

type ApiCase = {
  id: string;
  projectId?: string;
  sectionId: string;
  displayOrder?: number;
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

type ApiSection = { id: string; suiteId: string; name: string; parentSectionId?: string | null; displayOrder?: number };

export type SectionsBundle = {
  suiteId: string;
  sections: SectionNode[];
};

function asNum(id: string): number {
  return Number(id);
}

async function fetchAllPagedRows<T>(buildPath: (page: number, pageSize: number) => string, pageSize = 200): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await apiFetch<Paged<T>>(buildPath(page, pageSize));
    out.push(...res.data);
    totalPages = Math.max(1, res.totalPages ?? 1);
    page += 1;
  }
  return out;
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
    displayOrder: row.displayOrder ?? 0,
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
  const suites = await fetchAllPagedRows<{ id: string }>(
    (page, pageSize) => `/api/projects/${projectId}/suites?page=${page}&pageSize=${pageSize}`
  );
  const first = suites[0];
  if (!first) return { suiteId: "", sections: [] };
  const sectionsBySuite = await Promise.all(
    suites.map((suite) =>
      fetchAllPagedRows<ApiSection>(
        (page, pageSize) => `/api/suites/${suite.id}/sections?page=${page}&pageSize=${pageSize}`
      )
    )
  );
  const allSections = sectionsBySuite.flat();
  return {
    suiteId: String(first.id),
    sections: allSections.map((section) => ({
      id: asNum(section.id),
      suiteId: asNum(section.suiteId),
      name: section.name,
      parentSectionId: section.parentSectionId ? asNum(section.parentSectionId) : null,
      displayOrder: section.displayOrder ?? 0
    }))
  };
}

export async function createSection(suiteId: string, name: string, parentSectionId?: number | null): Promise<SectionNode> {
  const res = await apiFetch<Ok<ApiSection>>(`/api/suites/${suiteId}/sections`, {
    method: "POST",
    body: {
      name,
      ...(parentSectionId !== undefined ? { parentSectionId } : {})
    }
  });
  return {
    id: asNum(res.data.id),
    suiteId: asNum(res.data.suiteId),
    name: res.data.name,
    parentSectionId: res.data.parentSectionId ? asNum(res.data.parentSectionId) : null,
    displayOrder: res.data.displayOrder ?? 0
  };
}

export async function updateSection(
  sectionId: number,
  patch: { name?: string; parentSectionId?: number | null }
): Promise<SectionNode> {
  const res = await apiFetch<Ok<ApiSection>>(`/api/sections/${sectionId}`, {
    method: "PATCH",
    body: patch
  });
  return {
    id: asNum(res.data.id),
    suiteId: asNum(res.data.suiteId),
    name: res.data.name,
    parentSectionId: res.data.parentSectionId ? asNum(res.data.parentSectionId) : null,
    displayOrder: res.data.displayOrder ?? 0
  };
}

export async function deleteSection(sectionId: number): Promise<void> {
  await apiFetch<void>(`/api/sections/${sectionId}`, { method: "DELETE" });
}

export type ReorderSectionsResult = {
  suiteId: string;
  parentSectionId: string | null;
  orderedSectionIds: string[];
  updated: number;
};

export async function reorderSections(
  suiteId: string,
  input: { parentSectionId?: number | null; orderedSectionIds: number[] }
): Promise<ReorderSectionsResult> {
  const res = await apiFetch<Ok<ReorderSectionsResult>>(`/api/suites/${suiteId}/sections/reorder`, {
    method: "POST",
    body: input
  });
  return res.data;
}

export type CopySectionSubtreeResult = {
  sourceSectionId: string;
  copiedSectionId: string;
  targetParentSectionId: string | null;
  sectionIdMap: Array<{ sourceSectionId: string; copiedSectionId: string }>;
  caseIdMap: Array<{ sourceCaseId: string; copiedCaseId: string }>;
};

export async function copySectionSubtree(
  sectionId: number,
  input: { targetParentSectionId?: number | null } = {}
): Promise<CopySectionSubtreeResult> {
  const res = await apiFetch<Ok<CopySectionSubtreeResult>>(`/api/sections/${sectionId}/copy`, {
    method: "POST",
    body: input
  });
  return res.data;
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
  if (filters.refs) params.set("refs", filters.refs);
  if (filters.labels) params.set("labels", filters.labels);
  if (filters.estimate) params.set("estimate", filters.estimate);
  if (filters.sectionScope) params.set("sectionScope", filters.sectionScope);
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

export type BulkCopyCasesResult = {
  requested: number;
  copied: number;
  failed: number;
  targetSectionId: string;
  items: Array<{ sourceCaseId: string; copiedCaseId: string | null; success: boolean; error: string | null }>;
};

export async function bulkCopyCases(
  projectId: string,
  caseIds: number[],
  targetSectionId: number
): Promise<BulkCopyCasesResult> {
  const res = await apiFetch<Ok<BulkCopyCasesResult>>(`/api/projects/${projectId}/cases/bulk-copy`, {
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

export type ReorderCasesResult = {
  sectionId: string;
  orderedCaseIds: string[];
  updated: number;
};

export async function reorderCases(
  projectId: string,
  sectionId: number,
  orderedCaseIds: number[]
): Promise<ReorderCasesResult> {
  const res = await apiFetch<Ok<ReorderCasesResult>>(`/api/projects/${projectId}/cases/reorder`, {
    method: "POST",
    body: { sectionId, orderedCaseIds }
  });
  return res.data;
}

export type PositionCasesResult = {
  sectionId: string;
  movedCaseIds: string[];
  orderedCaseIds: string[];
  updated: number;
};

export async function positionCases(
  projectId: string,
  input: { sectionId: number; caseIds: number[]; beforeCaseId?: number; afterCaseId?: number }
): Promise<PositionCasesResult> {
  const res = await apiFetch<Ok<PositionCasesResult>>(`/api/projects/${projectId}/cases/position`, {
    method: "POST",
    body: input
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
