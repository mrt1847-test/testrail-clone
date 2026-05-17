import type { PrismaClient } from "@prisma/client";

import {
  buildMilestoneSummaryPayload,
  type MilestoneDirectMetrics,
  type MilestoneSummaryMeta
} from "../../domain/milestoneRollup.js";
import { listMemoryMilestones } from "../milestones/milestones.routes.js";
import type { RunsRepository } from "../runs/runs.repository.js";
function directMetricsFromStatuses(
  statuses: string[],
  runCount: number,
  openRunCount: number
): MilestoneDirectMetrics {
  return { statuses, runCount, openRunCount };
}

export async function buildMilestoneSummary(
  projectId: bigint,
  deps: { repo?: RunsRepository; prisma?: PrismaClient }
) {
  if (deps.prisma) {
    const milestones = await deps.prisma.milestone.findMany({
      where: { projectId, deletedAt: null },
      orderBy: [{ isCompleted: "asc" }, { id: "desc" }]
    });
    const metas: MilestoneSummaryMeta[] = milestones.map((milestone) => ({
      milestoneId: milestone.id.toString(),
      name: milestone.name,
      parentMilestoneId: milestone.parentMilestoneId?.toString() ?? null,
      isCompleted: milestone.isCompleted,
      startDate: milestone.startDate
    }));
    const directById = new Map<string, MilestoneDirectMetrics>();

    for (const milestone of milestones) {
      const runs = await deps.prisma.testRun.findMany({
        where: { projectId, milestoneId: milestone.id, deletedAt: null },
        include: { instances: { where: { deletedAt: null }, select: { status: true } } }
      });
      const statuses = runs.flatMap((run) => run.instances.map((instance) => instance.status));
      directById.set(
        milestone.id.toString(),
        directMetricsFromStatuses(
          statuses,
          runs.length,
          runs.filter((run) => run.status === "open").length
        )
      );
    }

    return buildMilestoneSummaryPayload(metas, directById);
  }

  if (!deps.repo) {
    throw new Error("MILESTONE_SUMMARY_REPO_REQUIRED");
  }

  const memoryMilestones = listMemoryMilestones(projectId);
  const metas: MilestoneSummaryMeta[] = memoryMilestones.map((milestone) => ({
    milestoneId: milestone.id.toString(),
    name: milestone.name,
    parentMilestoneId: milestone.parentMilestoneId?.toString() ?? null,
    isCompleted: milestone.isCompleted,
    startDate: milestone.startDate
  }));
  const directById = new Map<string, MilestoneDirectMetrics>();

  const runs = await deps.repo.listRunsByProject(projectId);
  for (const run of runs) {
    if (run.milestoneId == null) continue;
    const key = run.milestoneId.toString();
    const bucket =
      directById.get(key) ??
      directMetricsFromStatuses([], 0, 0);
    bucket.runCount += 1;
    if (run.status === "open") bucket.openRunCount += 1;
    const instances = await deps.repo.listInstancesForRun(run.id);
    bucket.statuses.push(...instances.map((instance) => instance.status));
    directById.set(key, bucket);
  }

  for (const milestone of memoryMilestones) {
    const key = milestone.id.toString();
    if (!directById.has(key)) {
      directById.set(key, directMetricsFromStatuses([], 0, 0));
    }
  }

  return buildMilestoneSummaryPayload(metas, directById);
}
