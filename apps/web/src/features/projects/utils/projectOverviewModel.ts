import type { MilestoneSummaryPayload } from "../api/milestoneSummaryApi";
import type { PlanRow } from "../api/planningApi";
import type { RunPlanOverviewItem } from "../../runs/api/runsOverviewApi";
import type { ProjectOverviewDto } from "../types";

export type OverviewWorkRow = {
  id: string;
  kind: "Run" | "Plan";
  name: string;
  href: string;
  summary: string;
};

export function formatOverviewExecution(execution: ProjectOverviewDto["execution"]) {
  const remaining = execution.remaining;
  const remainingLabel = remaining === 1 ? "1 remaining" : `${remaining} remaining`;
  return `${execution.passed} passed · ${execution.failed} failed · ${remainingLabel}`;
}

export function formatOverviewRunSummary(run: ProjectOverviewDto["recentRuns"][number], overview?: RunPlanOverviewItem) {
  if (overview && overview.totalTests > 0) {
    const untested = overview.statusCounts.untested ?? 0;
    const blocked = overview.statusCounts.blocked ?? 0;
    const parts = [`${overview.totalTests} tests`];
    if (untested > 0) parts.push(`${untested} untested`);
    if (blocked > 0) parts.push(`${blocked} blocked`);
    if (overview.percentPassed > 0) parts.push(`${overview.percentPassed}% passed`);
    return parts.join(" · ");
  }
  if (run.total > 0) {
    const parts = [`${run.total} tests`, `${run.progress}%`];
    if (run.failed > 0) parts.push(`${run.failed} failed`);
    return parts.join(" · ");
  }
  return run.status === "closed" ? "Closed" : "No tests yet";
}

export function buildOverviewWorkRows(input: {
  projectId: string;
  recentRuns: ProjectOverviewDto["recentRuns"];
  plans: readonly PlanRow[];
  overviewItems: readonly RunPlanOverviewItem[];
}): OverviewWorkRow[] {
  const overviewById = new Map(input.overviewItems.map((item) => [item.id, item]));
  const planRows: OverviewWorkRow[] = input.plans.slice(0, 3).map((plan) => {
    const overview = overviewById.get(plan.id);
    return {
      id: `plan-${plan.id}`,
      kind: "Plan",
      name: plan.name,
      href: `/projects/${input.projectId}/plans/${plan.id}`,
      summary: overview && overview.totalTests > 0 ? `${overview.totalTests} tests` : "Open plan"
    };
  });
  const runRows: OverviewWorkRow[] = input.recentRuns
    .filter((run) => run.status !== "closed")
    .slice(0, 5)
    .map((run) => ({
      id: `run-${run.id}`,
      kind: "Run",
      name: run.name,
      href: `/projects/${input.projectId}/runs/${run.id}`,
      summary: formatOverviewRunSummary(run, overviewById.get(run.id))
    }));
  return [...runRows, ...planRows];
}

export function openMilestones(summary?: MilestoneSummaryPayload) {
  return (summary?.items ?? [])
    .filter((row) => row.lifecycleStatus !== "completed")
    .slice()
    .sort((a, b) => (a.forecast.projectedCompletionDate ?? "").localeCompare(b.forecast.projectedCompletionDate ?? ""))
    .slice(0, 5);
}

export function overviewAttentionItems(input: {
  projectId: string;
  recentFailures: ProjectOverviewDto["recentFailures"];
  recentResults?: ProjectOverviewDto["recentResults"];
}) {
  const fromFailures = input.recentFailures.map((failure) => ({
    id: `${failure.runId}-${failure.caseCode}`,
    label: `${failure.caseCode} ${failure.title}`.trim(),
    href: `/projects/${input.projectId}/runs/${failure.runId}`,
    meta: failure.runName
  }));
  const fromBlocked = (input.recentResults ?? [])
    .filter((result) => result.status === "blocked" || result.status === "failed")
    .map((result) => ({
      id: `${result.runId ?? result.source}-${result.caseCode}-${result.at}`,
      label: `${result.caseCode} ${result.title ?? result.status}`.trim(),
      href: result.runId ? `/projects/${input.projectId}/runs/${result.runId}` : `/projects/${input.projectId}/runs`,
      meta: result.status
    }));
  const seen = new Set<string>();
  return [...fromFailures, ...fromBlocked]
    .filter((item) => {
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    })
    .slice(0, 4);
}
