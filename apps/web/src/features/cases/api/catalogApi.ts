import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import type { CasePriority, CaseType, SectionNode, TestCase } from "../types";

type ApiCase = {
  id: string;
  sectionId: string;
  title: string;
  priority?: string;
  caseType?: string;
};

type ApiSection = { id: string; name: string };

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
    caseCode: `C${row.id}`,
    title: row.title,
    type: normalizeType(row.caseType),
    priority: normalizePriority(row.priority),
    automationStatus: "manual",
    estimate: "—",
    references: "",
    labels: [],
    automationKey: "",
    preconditions: "",
    steps: [{ description: "—", expected: "—" }],
    sectionId: asNum(row.sectionId),
    updatedAt: "—"
  };
}

export async function fetchSectionsForProject(projectId: string): Promise<SectionNode[]> {
  const suites = await apiFetch<Paged<{ id: string }>>(
    `/api/projects/${projectId}/suites?page=1&pageSize=50`
  );
  const first = suites.data[0];
  if (!first) return [];
  const sections = await apiFetch<Paged<ApiSection>>(
    `/api/suites/${first.id}/sections?page=1&pageSize=200`
  );
  return sections.data.map((s) => ({ id: asNum(s.id), name: s.name }));
}

export async function fetchCasesForSection(projectId: string, sectionId: number): Promise<TestCase[]> {
  const res = await apiFetch<Paged<ApiCase>>(
    `/api/projects/${projectId}/cases?sectionId=${sectionId}&page=1&pageSize=500`
  );
  return res.data.map(mapApiCaseToTestCase);
}

export async function fetchCaseById(caseId: number): Promise<TestCase> {
  const res = await apiFetch<Ok<ApiCase>>(`/api/cases/${caseId}`);
  return mapApiCaseToTestCase(res.data);
}
