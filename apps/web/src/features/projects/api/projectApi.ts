import { apiFetch } from "../../../shared/api/http";
import type { Paged } from "../../../shared/api/types";
import { normalizeProjectType, type ProjectType } from "../types/projectTypes";
import type { ProjectOverviewDto, ProjectSummary } from "../types";

type ProjectRow = {
  id: string;
  name: string;
  description?: string;
  projectType?: string;
  isArchived?: boolean;
};

type RunRow = { id: string; name: string; status: string };
type RunSummaryRow = {
  runId: string;
  name: string;
  status: string;
  total: number;
  passed: number;
  failed: number;
  progress: number;
};
type ReportActivityRow = {
  runId: string;
  runName?: string;
  caseId: string;
  title: string;
  status: string;
  source?: string;
  createdAt?: string;
};

async function fetchFirstSuiteId(projectId: string): Promise<string | null> {
  const res = await apiFetch<Paged<{ id: string }>>(`/api/projects/${projectId}/suites?page=1&pageSize=1`);
  return res.data[0]?.id ?? null;
}

function mapProject(row: ProjectRow): ProjectSummary {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    projectType: normalizeProjectType(row.projectType),
    isArchived: Boolean(row.isArchived)
  };
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await apiFetch<Paged<ProjectRow>>("/api/projects?page=1&pageSize=100");
  return res.data.map(mapProject);
}

export async function fetchProject(projectId: string): Promise<ProjectSummary | null> {
  try {
    const res = await apiFetch<{ data: ProjectRow }>(`/api/projects/${projectId}`);
    const p = res.data;
    return mapProject(p);
  } catch {
    return null;
  }
}

export async function updateProject(
  projectId: string,
  patch: { name?: string; description?: string; projectType?: ProjectType }
): Promise<ProjectSummary> {
  const res = await apiFetch<{ data: ProjectRow }>(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: patch
  });
  return mapProject(res.data);
}

export async function createProject(name: string, projectType: ProjectType = "single_repo"): Promise<ProjectSummary> {
  const res = await apiFetch<{ data: ProjectRow }>("/api/projects", {
    method: "POST",
    body: { name, projectType }
  });
  return mapProject(res.data);
}

export async function archiveProject(projectId: string): Promise<ProjectSummary> {
  const res = await apiFetch<{ data: ProjectRow }>(`/api/projects/${projectId}/archive`, { method: "POST" });
  return mapProject(res.data);
}

export async function restoreProject(projectId: string): Promise<ProjectSummary> {
  const res = await apiFetch<{ data: ProjectRow }>(`/api/projects/${projectId}/restore`, { method: "POST" });
  return mapProject(res.data);
}

export async function fetchProjectOverview(projectId: string): Promise<ProjectOverviewDto> {
  const [overviewRes, runsRes, runSummaryRes, failuresRes, resultsRes] = await Promise.all([
    apiFetch<{ data: { totalCases: number; activeRuns: number; recentFailures: number; automationCoveragePct: number } }>(
      `/api/projects/${projectId}/overview`
    ),
    apiFetch<Paged<RunRow>>(`/api/projects/${projectId}/runs?page=1&pageSize=20`),
    apiFetch<{ data: { items: RunSummaryRow[] } }>(`/api/projects/${projectId}/reports/run-summary`),
    apiFetch<{ data: { items: ReportActivityRow[] } }>(`/api/projects/${projectId}/reports/recent-failures`),
    apiFetch<{ data: { items: ReportActivityRow[] } }>(`/api/projects/${projectId}/reports/recent-results`)
  ]);

  const totalCases = overviewRes.data.totalCases;
  const runs = runsRes.data;
  const activeRuns = overviewRes.data.activeRuns;
  const runSummaryMap = new Map<string, RunSummaryRow>(
    runSummaryRes.data.items.map((row: RunSummaryRow) => [String(row.runId), row])
  );

  const recentRuns = runs.slice(0, 5).map((r: RunRow) => {
    const summary = runSummaryMap.get(String(r.id));
    return {
      id: String(r.id),
      name: r.name,
      status: r.status,
      progress: summary?.progress ?? 0,
      total: summary?.total ?? 0,
      passed: summary?.passed ?? 0,
      failed: summary?.failed ?? 0,
      createdAt: "-"
    };
  });
  const execution = runSummaryRes.data.items.reduce(
    (acc, row) => {
      acc.total += row.total;
      acc.passed += row.passed;
      acc.failed += row.failed;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, remaining: 0 }
  );
  execution.remaining = Math.max(0, execution.total - execution.passed - execution.failed);

  return {
    stats: {
      totalCases,
      activeRuns,
      recentFailures: overviewRes.data.recentFailures,
      automationCoveragePct: overviewRes.data.automationCoveragePct
    },
    execution,
    recentRuns,
    recentFailures: failuresRes.data.items.map((item: ReportActivityRow) => ({
      caseCode: `C${item.caseId}`,
      runId: item.runId,
      runName: item.runName ?? `Run ${item.runId}`,
      title: item.title,
      at: item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"
    })),
    recentResults: resultsRes.data.items.map((item: ReportActivityRow) => ({
      caseCode: `C${item.caseId}`,
      status: item.status,
      source: item.source ?? "manual",
      at: item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"
    }))
  };
}
