import { buildRunProgressMetrics } from "../../domain/runProgress.js";
import type { RunsRepository } from "./runs.repository.js";

export async function loadRunProgressMetrics(repo: RunsRepository, runId: bigint) {
  return repo.transaction(async (tx) => {
    const rows = await tx.getInstancesByRunId(runId);
    return buildRunProgressMetrics(rows.map((row) => row.status));
  });
}
