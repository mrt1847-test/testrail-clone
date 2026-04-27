import type { RunsRepository } from "../runs/runs.repository.js";

export async function calculateRunSummary(repo: RunsRepository, runId: bigint) {
  return repo.transaction(async (tx) => {
    const instances = await tx.getInstancesByRunId(runId);
    const total = instances.length;
    const counts = instances.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
    const completed =
      (counts.passed ?? 0) + (counts.failed ?? 0) + (counts.blocked ?? 0) + (counts.retest ?? 0);
    return {
      runId,
      total,
      counts,
      completionRate: total === 0 ? 0 : completed / total
    };
  });
}
