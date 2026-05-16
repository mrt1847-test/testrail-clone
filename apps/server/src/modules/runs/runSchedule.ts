import type { PrismaClient } from "@prisma/client";

import { buildRunDateWarnings, type MilestoneSchedule } from "../../domain/runDates.js";
import type { TestRun } from "./runs.types.js";

export async function runDateWarningsForRun(
  prisma: PrismaClient | undefined,
  run: TestRun
): Promise<string[]> {
  let milestone: MilestoneSchedule | null = null;
  let planName: string | null = null;
  if (prisma && run.milestoneId) {
    const row = await prisma.milestone.findFirst({
      where: { id: run.milestoneId, deletedAt: null },
      select: { startDate: true, dueDate: true }
    });
    if (row) {
      milestone = { startDate: row.startDate, dueDate: row.dueDate };
    }
  }
  if (prisma && run.planId) {
    const plan = await prisma.testPlan.findFirst({
      where: { id: run.planId, deletedAt: null },
      select: { name: true }
    });
    planName = plan?.name ?? null;
  }
  return buildRunDateWarnings({
    status: run.status,
    startedAt: run.startedAt ?? null,
    dueOn: run.dueOn ?? null,
    closedAt: run.closedAt ?? null,
    milestone,
    planName
  });
}
