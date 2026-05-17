import type { Prisma } from "@prisma/client";
import { computeAssignmentAging, type AssignmentAgingLevel } from "@testrail-clone/shared";

import type { TestStatus } from "../../domain/status.js";

export type AssignmentTestRow = {
  testId: bigint;
  runId: bigint;
  runName: string;
  caseId: bigint;
  title: string;
  status: TestStatus;
  assignedTo: bigint | null;
  runDueOn: Date | null;
  milestoneId: bigint | null;
  milestoneName: string | null;
  agingLevel: AssignmentAgingLevel;
  assignee?: { id: bigint; name: string; email: string } | null;
};

export function assignmentAgingForRow(input: {
  status: TestStatus;
  runDueOn: Date | null;
  updatedAt: Date;
}) {
  return computeAssignmentAging({
    status: input.status,
    runDueOn: input.runDueOn,
    updatedAt: input.updatedAt
  });
}

export type AssignmentListFilters = {
  status?: TestStatus;
  runId?: bigint;
  q?: string;
  milestoneId?: bigint | "none";
  dueBefore?: Date;
  dueAfter?: Date;
  overdue?: boolean;
  dueUnset?: boolean;
};

export function buildRunScheduleWhereForAssignmentList(
  filters: AssignmentListFilters
): Prisma.TestRunWhereInput {
  const run: Prisma.TestRunWhereInput = {};

  if (filters.milestoneId === "none") {
    run.milestoneId = null;
  } else if (filters.milestoneId) {
    run.milestoneId = filters.milestoneId;
  }

  if (filters.dueUnset) {
    run.dueOn = null;
    return run;
  }

  const dueOn: Prisma.DateTimeNullableFilter = {};
  if (filters.overdue) {
    dueOn.lt = new Date();
  }
  if (filters.dueBefore) {
    dueOn.lte = filters.dueBefore;
  }
  if (filters.dueAfter) {
    dueOn.gte = filters.dueAfter;
  }
  if (Object.keys(dueOn).length > 0) {
    run.dueOn = dueOn;
  }

  return run;
}

export function matchesAssignmentListFiltersInMemory(
  run: { milestoneId: bigint | null; dueOn?: Date | null },
  filters: AssignmentListFilters
): boolean {
  if (filters.milestoneId === "none" && run.milestoneId != null) return false;
  if (filters.milestoneId && filters.milestoneId !== "none" && run.milestoneId !== filters.milestoneId) {
    return false;
  }
  if (filters.dueUnset) return run.dueOn == null;
  if (filters.overdue && (run.dueOn == null || run.dueOn >= new Date())) return false;
  if (filters.dueBefore && (run.dueOn == null || run.dueOn > filters.dueBefore)) return false;
  if (filters.dueAfter && (run.dueOn == null || run.dueOn < filters.dueAfter)) return false;
  return true;
}
