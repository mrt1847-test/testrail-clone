import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import type { RunDetailDto, RunSummary } from "../types";

type ApiRun = { id: string; name: string; status: string; includeAll?: boolean };

type ApiInstance = {
  id: string;
  caseId: string;
  titleSnapshot: string;
  status: string;
};

type RunDetailPayload = { run: ApiRun; instances: ApiInstance[] };

type RunSummaryResponse = {
  runId: string;
  total: number;
  counts: Record<string, number>;
  completionRate: number;
};

export async function fetchRuns(projectId: string): Promise<RunSummary[]> {
  const res = await apiFetch<Paged<ApiRun>>(`/api/projects/${projectId}/runs?page=1&pageSize=100`);
  return res.data.map((r) => ({
    id: String(r.id),
    name: r.name,
    status: r.status === "closed" ? "closed" : "open",
    progress: 0,
    failed: 0,
    createdAt: "—"
  }));
}

export async function fetchRunDetail(projectId: string, runId: string): Promise<RunDetailDto | null> {
  void projectId;
  try {
    const [detailRes, summaryRes] = await Promise.all([
      apiFetch<Ok<RunDetailPayload>>(`/api/runs/${runId}`),
      apiFetch<RunSummaryResponse>(`/api/runs/${runId}/summary`)
    ]);
    const { run, instances } = detailRes.data;
    const counts = summaryRes.counts ?? {};
    const passed = counts.passed ?? 0;
    const failed = counts.failed ?? 0;
    const blocked = counts.blocked ?? 0;
    const retest = counts.retest ?? 0;
    const untested = counts.untested ?? 0;
    const progress = Math.round((summaryRes.completionRate ?? 0) * 100);

    return {
      run: {
        id: String(run.id),
        name: run.name,
        status: run.status === "closed" ? "closed" : "open",
        progress,
        failed,
        createdAt: "—"
      },
      instances: instances.map((i) => ({
        id: String(i.id),
        caseCode: `C${i.caseId}`,
        title: i.titleSnapshot,
        status: i.status
      })),
      counts: { passed, failed, blocked, retest, untested }
    };
  } catch {
    return null;
  }
}

export async function createRun(projectId: string, name: string): Promise<RunSummary> {
  const suites = await apiFetch<Paged<{ id: string }>>(
    `/api/projects/${projectId}/suites?page=1&pageSize=1`
  );
  const suiteId = suites.data[0]?.id;
  if (!suiteId) {
    throw new Error("No suite found for project. Create a suite first.");
  }
  const created = await apiFetch<{ run: ApiRun; instances: ApiInstance[] }>("/api/runs", {
    method: "POST",
    body: {
      projectId,
      suiteId,
      name,
      includeAll: true
    }
  });
  return {
    id: String(created.run.id),
    name: created.run.name,
    status: created.run.status === "closed" ? "closed" : "open",
    progress: 0,
    failed: 0,
    createdAt: "—"
  };
}
