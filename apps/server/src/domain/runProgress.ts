import type { TestStatus } from "./status.js";

export type RunStatusCounts = Record<TestStatus, number>;

export type RunProgressMetrics = {
  total: number;
  counts: RunStatusCounts;
  executed: number;
  completionRate: number;
  progressPercent: number;
  passed: number;
  failed: number;
  blocked: number;
  retest: number;
  untested: number;
};

const EMPTY_COUNTS = (): RunStatusCounts => ({
  passed: 0,
  failed: 0,
  blocked: 0,
  retest: 0,
  untested: 0
});

export function buildRunProgressMetrics(statuses: Iterable<string>): RunProgressMetrics {
  const counts = EMPTY_COUNTS();
  for (const status of statuses) {
    if (status in counts) {
      counts[status as TestStatus] += 1;
    }
  }
  const total =
    counts.passed + counts.failed + counts.blocked + counts.retest + counts.untested;
  const executed = total - counts.untested;
  const completionRate = total === 0 ? 0 : executed / total;
  return {
    total,
    counts,
    executed,
    completionRate,
    progressPercent: Math.round(completionRate * 100),
    passed: counts.passed,
    failed: counts.failed,
    blocked: counts.blocked,
    retest: counts.retest,
    untested: counts.untested
  };
}

export function runProgressMetricsToApi(metrics: RunProgressMetrics) {
  return {
    total: metrics.total,
    counts: metrics.counts,
    executed: metrics.executed,
    completionRate: metrics.completionRate,
    progressPercent: metrics.progressPercent
  };
}
