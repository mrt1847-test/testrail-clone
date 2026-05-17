import { runProgressMetricsToApi } from "../../domain/runProgress.js";
import { loadRunProgressMetrics } from "../runs/runProgressMetrics.js";
import type { RunsRepository } from "../runs/runs.repository.js";

export async function calculateRunSummary(repo: RunsRepository, runId: bigint) {
  const metrics = await loadRunProgressMetrics(repo, runId);
  return {
    runId,
    ...runProgressMetricsToApi(metrics)
  };
}
