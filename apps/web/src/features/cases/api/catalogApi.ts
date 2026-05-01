import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import type { CasePriority, CaseType, CaseVersion, SectionNode, TestCase } from "../types";

type ApiCase = {
  id: string;
  projectId?: string;
  sectionId: string;
  title: string;
  priority?: string;
  caseType?: string;
  preconditions?: string | null;
  customValues?: Record<string, string | number | boolean | null>;
  lockVersion?: number;
  updatedAt?: string;
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
  const id = asNum(row.id);
  return {
    id,
    projectId: row.projectId ? asNum(row.projectId) : undefined,
    caseCode: `C${row.id}`,
    title: row.title,
    type: normalizeType(row.caseType),
    priority: normalizePriority(row.priority),
    automationStatus: "manual",
    estimate: "—",
    references: "",
    labels: [],
    automationKey: "",
    preconditions: row.preconditions ?? "",
    customValues: row.customValues ?? {},
    steps: [],
    sectionId: asNum(row.sectionId),
    lockVersion: row.lockVersion ?? 1,
    updatedAt: row.updatedAt ?? "—"
  };
}

function mapApiCaseDetailToTestCase(row: ApiCaseDetail): TestCase {
  const base = mapApiCaseToTestCase(row);
  if (row.steps && row.steps.length > 0) {
    return {
      ...base,
      steps: row.steps.map((s: NonNullable<ApiCaseDetail["steps"]>[number]) => ({
        ...("id" in s && s.id != null ? { id: asNum(s.id), stepOrder: s.stepOrder } : { stepOrder: s.stepOrder }),
        description: s.content,
        expected: s.expectedResult ?? "—"
      }))
    };
  }
  return { ...base, steps: [] };
}

export async function fetchSectionsForProject(projectId: string): Promise<SectionsBundle> {
  const suites = await apiFetch<Paged<{ id: string }>>(
    `/api/projects/${projectId}/suites?page=1&pageSize=50`
  );
  const first = suites.data[0];
  if (!first) return { suiteId: "", sections: [] };
  const sections = await apiFetch<Paged<ApiSection>>(
    `/api/suites/${first.id}/sections?page=1&pageSize=200`
  );
  return {
    suiteId: String(first.id),
    sections: sections.data.map((s: ApiSection) => ({ id: asNum(s.id), name: s.name }))
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
  page = 1,
  pageSize = 100
): Promise<TestCase[]> {
  const res = await apiFetch<Paged<ApiCase>>(
    `/api/projects/${projectId}/cases?sectionId=${sectionId}&page=${page}&pageSize=${pageSize}`
  );
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

