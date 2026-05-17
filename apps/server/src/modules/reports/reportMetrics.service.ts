export type ReportStatus = "passed" | "failed" | "blocked" | "retest" | "untested";

import { buildRunProgressMetrics } from "../../domain/runProgress.js";

export type RunSummaryMetrics = {
  total: number;
  passed: number;
  failed: number;
  progress: number;
};

export function toStatusCounters(statuses: Iterable<string>) {
  const counters: Record<ReportStatus, number> = {
    passed: 0,
    failed: 0,
    blocked: 0,
    retest: 0,
    untested: 0
  };

  for (const status of statuses) {
    if (status in counters) {
      counters[status as ReportStatus] += 1;
    }
  }
  return counters;
}

export function toRunSummaryMetrics(statuses: Iterable<string>): RunSummaryMetrics {
  const metrics = buildRunProgressMetrics(statuses);
  return {
    total: metrics.total,
    passed: metrics.passed,
    failed: metrics.failed,
    progress: metrics.progressPercent
  };
}

export function latestByCreatedAt<T extends { createdAt: Date }>(items: Array<T | null | undefined>) {
  return items
    .filter((item): item is T => Boolean(item))
    .sort((a, b) => +b.createdAt - +a.createdAt)[0];
}

export function isAtRiskStatus(status: string) {
  return status === "failed" || status === "blocked" || status === "retest";
}

export function toCoverageStatus(latestStatuses: string[], linkedCaseCount: number) {
  if (linkedCaseCount === 0) return "uncovered";
  if (latestStatuses.some(isAtRiskStatus)) return "at_risk";
  if (latestStatuses.some((status) => status === "passed")) return "covered";
  return "untested";
}

export function toUniqueDefectKeys(
  results: Array<{
    status: string;
    defectLinks: Array<{ defectKey: string }>;
  }>
) {
  const keys = new Set<string>();
  for (const result of results) {
    if (!isAtRiskStatus(result.status)) continue;
    for (const link of result.defectLinks) {
      const normalized = link.defectKey.trim();
      if (normalized.length > 0) keys.add(normalized);
    }
  }
  return Array.from(keys);
}
