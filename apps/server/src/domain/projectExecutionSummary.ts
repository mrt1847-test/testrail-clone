import { buildRunProgressMetrics } from "./runProgress.js";

export type ProjectRunRollupInput = {
  runId: string;
  name: string;
  status: string;
  total: number;
  passed: number;
  failed: number;
  progress: number;
};

export type ProjectExecutionSummary = {
  totalCases: number;
  automationCoveragePct: number;
  totalRuns: number;
  activeRuns: number;
  completedRuns: number;
  execution: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
    retest: number;
    untested: number;
    progress: number;
  };
  runs: ProjectRunRollupInput[];
};

export function buildProjectExecutionSummary(input: {
  totalCases: number;
  automationCoveragePct: number;
  runs: ProjectRunRollupInput[];
  executionStatuses: string[];
}): ProjectExecutionSummary {
  const activeRuns = input.runs.filter((run) => run.status === "open").length;
  const completedRuns = input.runs.filter((run) => run.status !== "open").length;
  const execution = buildRunProgressMetrics(input.executionStatuses);

  return {
    totalCases: input.totalCases,
    automationCoveragePct: input.automationCoveragePct,
    totalRuns: input.runs.length,
    activeRuns,
    completedRuns,
    execution: {
      total: execution.total,
      passed: execution.passed,
      failed: execution.failed,
      blocked: execution.blocked,
      retest: execution.retest,
      untested: execution.untested,
      progress: execution.progressPercent
    },
    runs: [...input.runs].sort((a, b) => a.name.localeCompare(b.name))
  };
}
