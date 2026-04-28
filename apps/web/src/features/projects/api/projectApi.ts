import { apiFetch } from "../../../shared/api/http";
import type { Paged } from "../../../shared/api/types";
import type { ProjectOverviewDto, ProjectSummary } from "../types";

type ProjectRow = { id: string; name: string; description?: string };

type RunRow = { id: string; name: string; status: string };
type RunSummaryRow = { runId: string; name: string; status: string; total: number; passed: number; failed: number; progress: number };
type ReportActivityRow = { runId: string; runName?: string; caseId: string; title: string; status: string; source?: string; createdAt?: string };

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
  return res.data.map((p: ProjectRow) => ({ id: String(p.id), name: p.name, description: p.description }));
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
  const [overviewRes, runsRes, runSummaryRes, failuresRes, resultsRes] = await Promise.all([
    apiFetch<{ data: { totalCases: number; activeRuns: number; recentFailures: number; automationCoveragePct: number } }>(
      `/api/projects/${projectId}/overview`
    ),
    apiFetch<Paged<RunRow>>(`/api/projects/${projectId}/runs?page=1&pageSize=20`),
    apiFetch<{ data: { items: RunSummaryRow[] } }>(`/api/projects/${projectId}/reports/run-summary`),
    apiFetch<{ data: { items: ReportActivityRow[] } }>(
      `/api/projects/${projectId}/reports/recent-failures`
    ),
    apiFetch<{ data: { items: ReportActivityRow[] } }>(
      `/api/projects/${projectId}/reports/recent-results`
    )
  ]);

  const totalCases = overviewRes.data.totalCases;
  const runs = runsRes.data;
  const activeRuns = overviewRes.data.activeRuns;
  const runSummaryMap = new Map<string, RunSummaryRow>(
    runSummaryRes.data.items.map((row: RunSummaryRow) => [String(row.runId), row])
  );

  const recentRuns = runs.slice(0, 5).map((r: RunRow) => ({
    id: String(r.id),
    name: r.name,
    status: r.status,
    progress: runSummaryMap.get(String(r.id))?.progress ?? 0,
    createdAt: "—"
  }));

  return {
    stats: {
      totalCases,
      activeRuns,
      recentFailures: overviewRes.data.recentFailures,
      automationCoveragePct: overviewRes.data.automationCoveragePct
    },
    recentRuns,
    recentFailures: failuresRes.data.items.map((item: ReportActivityRow) => ({
      caseCode: `C${item.caseId}`,
      runName: item.runName ?? `Run ${item.runId}`,
      title: item.title,
      at: item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"
    })),
    recentResults: resultsRes.data.items.map((item: ReportActivityRow) => ({
      caseCode: `C${item.caseId}`,
      status: item.status,
      source: item.source ?? "manual",
      at: item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"
    }))
  };
}
