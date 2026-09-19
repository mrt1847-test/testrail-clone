import type { CompletedOverviewItem, RunPlanOverviewItem } from "../api/runsOverviewApi";

export type RunListScope = "all" | "runs" | "plans";

export function parseRunListScope(raw: string | null): RunListScope {
  if (raw === "runs" || raw === "plans") return raw;
  return "all";
}

export function filterRunListOpenItems(
  items: readonly RunPlanOverviewItem[],
  scope: RunListScope
): RunPlanOverviewItem[] {
  if (scope === "runs") return items.filter((item) => item.type === "run");
  if (scope === "plans") return items.filter((item) => item.type === "plan");
  return [...items];
}

export function formatRunListKind(type: RunPlanOverviewItem["type"] | CompletedOverviewItem["type"]) {
  return type === "plan" ? "Plan" : "Run";
}

export function formatRunListWorkSummary(item: Pick<RunPlanOverviewItem, "totalTests" | "statusCounts">) {
  const untested = item.statusCounts.untested ?? 0;
  const total = item.totalTests;
  if (total <= 0) return "No tests yet";
  const testLabel = total === 1 ? "1 test" : `${total} tests`;
  if (untested <= 0) return testLabel;
  const untestedLabel = untested === 1 ? "1 untested" : `${untested} untested`;
  return `${testLabel} · ${untestedLabel}`;
}

export function describeRunListFilters(input: {
  scope: RunListScope;
  mine: boolean;
  milestoneId?: string | null;
  resultStatus?: string | null;
}) {
  const parts: string[] = [];
  if (input.scope === "runs") parts.push("Runs");
  if (input.scope === "plans") parts.push("Plans");
  if (input.mine) parts.push("Assigned to me");
  if (input.milestoneId && input.milestoneId !== "all") parts.push(`Milestone ${input.milestoneId}`);
  if (input.resultStatus === "passed" || input.resultStatus === "failed" || input.resultStatus === "untested") {
    parts.push(`${input.resultStatus} coverage`);
  }
  return parts;
}

export function runListReturnSearch(search: URLSearchParams) {
  return search.toString();
}

export function runListSessionKey(projectId: string) {
  return `testrail.lastView.runs.${projectId}`;
}

export function readStoredRunListSearch(projectId: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(runListSessionKey(projectId)) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredRunListSearch(projectId: string, search: string) {
  if (typeof window === "undefined") return;
  try {
    const key = runListSessionKey(projectId);
    if (search) window.sessionStorage.setItem(key, search);
    else window.sessionStorage.removeItem(key);
  } catch {
    /* ignore quota / private mode */
  }
}
