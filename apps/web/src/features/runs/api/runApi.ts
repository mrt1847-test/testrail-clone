import { apiFetch } from "../../../shared/api/http";
import type { Ok, Paged } from "../../../shared/api/types";
import type { RunDetailDto, RunSummary, TestResultHistoryItem, TestResultStepItem } from "../types";

type ApiRun = {
  id: string;
  name: string;
  status: string;
  includeAll?: boolean;
  environment?: string | null;
  assignedTo?: string | null;
  milestoneId?: string | null;
};

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
    createdAt: "—",
    milestoneId: r.milestoneId ? String(r.milestoneId) : null,
    assignedTo: r.assignedTo ? String(r.assignedTo) : null
  }));
}

export async function fetchRunDetail(projectId: string, runId: string): Promise<RunDetailDto | null> {
  try {
    const [detailRes, summaryRes] = await Promise.all([
      apiFetch<Ok<RunDetailPayload>>(`/api/projects/${projectId}/runs/${runId}`),
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
        environment: run.environment ?? undefined,
        milestoneId: run.milestoneId ? String(run.milestoneId) : null,
        assignedTo: run.assignedTo ? String(run.assignedTo) : null,
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

export async function addRunResult(input: {
  runId: string;
  testId: string;
  status: "passed" | "failed" | "blocked" | "retest" | "untested";
  comment?: string;
  elapsed?: string;
  version?: string;
  defects?: string[];
  stepResults?: Array<{ stepOrder: number; status: "passed" | "failed" | "blocked" | "retest" | "untested"; actualResult?: string; comment?: string }>;
}) {
  return apiFetch(`/api/runs/${input.runId}/results`, {
    method: "POST",
    body: {
      testId: input.testId,
      status: input.status,
      comment: input.comment,
      elapsed: input.elapsed,
      version: input.version,
      defects: input.defects,
      stepResults: input.stepResults
    }
  });
}

export async function closeRun(runId: string) {
  return apiFetch(`/api/runs/${runId}/close`, { method: "POST" });
}

export async function updateRunAssignee(runId: string, assignedTo: string | null) {
  return apiFetch(`/api/runs/${runId}`, {
    method: "PATCH",
    body: { assignedTo }
  });
}

export async function rerunFailed(runId: string) {
  return apiFetch(`/api/runs/${runId}/rerun`, {
    method: "POST",
    body: { statuses: ["failed"] }
  });
}

export type CreateRunInput = {
  projectId: string;
  suiteId: string;
  name: string;
  includeAll: boolean;
  caseIds?: string[];
  milestoneId?: string | null;
  environment?: string;
};

export async function createRun(input: CreateRunInput): Promise<RunSummary> {
  const created = await apiFetch<{ run: ApiRun; instances: ApiInstance[] }>(`/api/projects/${input.projectId}/runs`, {
    method: "POST",
    body: {
      suiteId: input.suiteId,
      name: input.name,
      includeAll: input.includeAll,
      caseIds: input.caseIds,
      milestoneId: input.milestoneId ?? undefined,
      environment: input.environment
    }
  });
  return {
    id: String(created.run.id),
    name: created.run.name,
    status: created.run.status === "closed" ? "closed" : "open",
    progress: 0,
    failed: 0,
    createdAt: "—",
    milestoneId: created.run.milestoneId ? String(created.run.milestoneId) : null,
    assignedTo: created.run.assignedTo ? String(created.run.assignedTo) : null
  };
}

type ApiResultHistory = {
  id: string;
  status: string;
  comment?: string;
  elapsed?: string;
  version?: string;
  source: "manual" | "automation" | "api";
  defects?: string[];
  createdAt: string;
};

export async function fetchTestResults(testId: string): Promise<TestResultHistoryItem[]> {
  const rows = await apiFetch<ApiResultHistory[]>(`/api/tests/${testId}/results`);
  return rows.map((row) => ({
    id: String(row.id),
    status: row.status,
    comment: row.comment,
    elapsed: row.elapsed,
    version: row.version,
    source: row.source,
    defects: row.defects ?? [],
    createdAt: row.createdAt
  }));
}

type ApiResultStep = {
  id: string;
  resultId: string;
  stepOrder: number;
  status: string;
  actualResult?: string;
  comment?: string;
  createdAt: string;
};

export async function fetchResultSteps(resultId: string): Promise<TestResultStepItem[]> {
  const rows = await apiFetch<ApiResultStep[]>(`/api/results/${resultId}/steps`);
  return rows.map((row) => ({
    id: String(row.id),
    resultId: String(row.resultId),
    stepOrder: row.stepOrder,
    status: row.status,
    actualResult: row.actualResult,
    comment: row.comment,
    createdAt: row.createdAt
  }));
}
