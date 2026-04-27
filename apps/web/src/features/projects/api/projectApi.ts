import { apiFetch } from "../../../shared/api/http";
import type { Paged } from "../../../shared/api/types";
import type { ProjectOverviewDto, ProjectSummary } from "../types";

type ProjectRow = { id: string; name: string; description?: string };

type CaseRow = { id: string; sectionId: string; title: string; priority?: string; caseType?: string };

type RunRow = { id: string; name: string; status: string };

async function fetchFirstSuiteId(projectId: string): Promise<string | null> {
  const res = await apiFetch<Paged<{ id: string }>>(`/api/projects/${projectId}/suites?page=1&pageSize=1`);
  return res.data[0]?.id ?? null;
}

async function bootstrapDefaultCatalog(projectId: string): Promise<void> {
  const suiteRes = await apiFetch<{ data: { id: string } }>(`/api/projects/${projectId}/suites`, {
    method: "POST",
    body: { name: "Main suite" }
  });
  const suiteId = suiteRes.data.id;
  await apiFetch(`/api/suites/${suiteId}/sections`, {
    method: "POST",
    body: { name: "General" }
  });
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await apiFetch<Paged<ProjectRow>>("/api/projects?page=1&pageSize=100");
  return res.data.map((p) => ({ id: String(p.id), name: p.name, description: p.description }));
}

export async function fetchProject(projectId: string): Promise<ProjectSummary | null> {
  try {
    const res = await apiFetch<{ data: ProjectRow }>(`/api/projects/${projectId}`);
    const p = res.data;
    return { id: String(p.id), name: p.name, description: p.description };
  } catch {
    return null;
  }
}

export async function createProject(name: string): Promise<ProjectSummary> {
  const res = await apiFetch<{ data: ProjectRow }>("/api/projects", {
    method: "POST",
    body: { name }
  });
  const created = res.data;
  const id = String(created.id);
  await bootstrapDefaultCatalog(id);
  return { id, name: created.name, description: created.description };
}

export async function fetchProjectOverview(projectId: string): Promise<ProjectOverviewDto> {
  const [casesRes, runsRes] = await Promise.all([
    apiFetch<Paged<CaseRow>>(`/api/projects/${projectId}/cases?page=1&pageSize=1`),
    apiFetch<Paged<RunRow>>(`/api/projects/${projectId}/runs?page=1&pageSize=20`)
  ]);

  const totalCases = casesRes.total;
  const runs = runsRes.data;
  const activeRuns = runs.filter((r) => r.status === "open").length;

  const recentRuns = runs.slice(0, 5).map((r) => ({
    id: String(r.id),
    name: r.name,
    status: r.status,
    progress: 0,
    createdAt: "—"
  }));

  return {
    stats: {
      totalCases,
      activeRuns,
      recentFailures: 0,
      automationCoveragePct: 0
    },
    recentRuns,
    recentFailures: [],
    recentResults: []
  };
}
