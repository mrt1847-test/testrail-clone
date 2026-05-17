import { AppError } from "../../common/errors/appError.js";
import {
  assertMilestoneParentLink,
  resolveMilestoneLifecycleStatus,
  type MilestoneLifecycleStatus
} from "../../domain/milestoneLifecycle.js";

export type MilestoneRecord = {
  id: bigint;
  projectId: bigint;
  parentMilestoneId: bigint | null;
  name: string;
  description?: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  isCompleted: boolean;
};

export type MilestoneDto = {
  id: bigint;
  projectId: bigint;
  name: string;
  isCompleted: boolean;
  startDate: string | null;
  dueDate: string | null;
  parentMilestoneId: string | null;
  lifecycleStatus: MilestoneLifecycleStatus;
};

export function toMilestoneDto(row: MilestoneRecord, now = new Date()): MilestoneDto {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    isCompleted: row.isCompleted,
    startDate: row.startDate?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    parentMilestoneId: row.parentMilestoneId?.toString() ?? null,
    lifecycleStatus: resolveMilestoneLifecycleStatus({
      isCompleted: row.isCompleted,
      startDate: row.startDate,
      now
    })
  };
}

export function parseOptionalDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("VALIDATION_ERROR", "invalid date value", 400);
  }
  return parsed;
}

export function validateMilestoneParent(input: {
  milestoneId: bigint | null;
  parentMilestoneId: bigint | null | undefined;
  rows: Array<{ id: bigint; parentMilestoneId: bigint | null }>;
}) {
  if (input.parentMilestoneId === undefined) return;
  try {
    assertMilestoneParentLink({
      milestoneId: input.milestoneId,
      parentMilestoneId: input.parentMilestoneId,
      rows: input.rows
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid parent milestone";
    if (message === "MILESTONE_PARENT_NOT_FOUND") {
      throw new AppError("VALIDATION_ERROR", "parent milestone not found in project", 400);
    }
    throw new AppError("VALIDATION_ERROR", "invalid milestone parent link", 400);
  }
}
