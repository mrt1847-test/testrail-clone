import type { PrismaClient } from "@prisma/client";

import type { BulkResultResponse } from "../results/results.types.js";
import { recordActivityEvent } from "./activity.service.js";

export function assignmentActivityPayload(
  assignedTo: bigint | null | undefined,
  extra: Record<string, unknown> = {}
) {
  const id = assignedTo?.toString() ?? null;
  return {
    assignedTo: id,
    assignedToUserId: id,
    ...(assignedTo != null ? { notifyUserId: id } : {}),
    ...extra
  };
}

export function bulkResultIds(res: BulkResultResponse) {
  return res.items
    .filter((item) => item.status === "saved")
    .map((item) => item.resultId.toString());
}

export async function recordBulkResultsActivity(
  prisma: PrismaClient | undefined,
  input: {
    projectId: bigint;
    runId: bigint;
    actorUserId?: bigint | null;
    res: BulkResultResponse;
  }
) {
  if (!prisma || input.res.saved <= 0) return;
  const failedCount = input.res.failed;
  await recordActivityEvent(prisma, {
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    entityType: "run",
    entityId: input.runId,
    eventType: "result.bulk_created",
    title: "Bulk results added",
    body: `${input.res.saved} saved, ${failedCount} failed of ${input.res.total}`,
    payload: {
      runId: input.runId.toString(),
      saved: input.res.saved,
      failed: failedCount,
      total: input.res.total,
      atomic: input.res.atomic,
      resultIds: bulkResultIds(input.res)
    }
  });
}

export async function recordRunAssignmentActivity(
  prisma: PrismaClient | undefined,
  input: {
    projectId: bigint;
    runId: bigint;
    actorUserId?: bigint | null;
    runName: string;
    assignedTo: bigint | null;
    extraPayload?: Record<string, unknown>;
  }
) {
  if (!prisma) return;
  await recordActivityEvent(prisma, {
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    entityType: "run",
    entityId: input.runId,
    eventType: "run.assigned",
    title: input.assignedTo ? "You were assigned a run" : "Run assignment cleared",
    body: input.runName,
    payload: assignmentActivityPayload(input.assignedTo, {
      runId: input.runId.toString(),
      ...input.extraPayload
    }),
    ...(input.assignedTo ? { notificationType: "assignment" as const } : {})
  });
}

export async function recordTestAssignmentActivity(
  prisma: PrismaClient | undefined,
  input: {
    projectId: bigint;
    testId: bigint;
    actorUserId?: bigint | null;
    assignedTo: bigint | null;
    titleSnapshot: string;
    runId: bigint;
    runName: string;
    caseId: bigint;
  }
) {
  if (!prisma) return;
  await recordActivityEvent(prisma, {
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    entityType: "test",
    entityId: input.testId,
    eventType: "test.assigned",
    title: input.assignedTo ? "You were assigned a test" : "Test assignment cleared",
    body: input.assignedTo ? `${input.titleSnapshot} · ${input.runName}` : input.titleSnapshot,
    payload: assignmentActivityPayload(input.assignedTo, {
      runId: input.runId.toString(),
      testId: input.testId.toString(),
      caseId: input.caseId.toString()
    }),
    ...(input.assignedTo ? { notificationType: "assignment" as const } : {})
  });
}

export async function recordPlanAssignmentActivity(
  prisma: PrismaClient | undefined,
  input: {
    projectId: bigint;
    planId: bigint;
    actorUserId?: bigint | null;
    planName: string;
    assignedTo: bigint | null;
    entryId?: bigint;
    entryName?: string;
  }
) {
  if (!prisma) return;
  const isEntry = input.entryId != null;
  await recordActivityEvent(prisma, {
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    entityType: isEntry ? "plan_entry" : "plan",
    entityId: isEntry ? input.entryId! : input.planId,
    eventType: isEntry ? "plan.entry_updated" : "plan.updated",
    title: input.assignedTo
      ? isEntry
        ? "You were assigned a plan entry"
        : "You were assigned a test plan"
      : isEntry
        ? "Plan entry assignment cleared"
        : "Test plan assignment cleared",
    body: isEntry ? (input.entryName ?? input.planName) : input.planName,
    payload: assignmentActivityPayload(input.assignedTo, {
      planId: input.planId.toString(),
      ...(isEntry ? { entryId: input.entryId!.toString() } : {})
    }),
    ...(input.assignedTo ? { notificationType: "assignment" as const } : {})
  });
}

export async function recordDefectMutationActivity(
  prisma: PrismaClient | undefined,
  input: {
    projectId: bigint;
    actorUserId?: bigint | null;
    resultId: bigint;
    eventType: "defect.linked" | "defect.unlinked" | "defect.pushed";
    title: string;
    body: string;
    payload: Record<string, unknown>;
    assigneeId?: bigint | null;
  }
) {
  if (!prisma) return;
  const assignee = input.assigneeId?.toString() ?? null;
  await recordActivityEvent(prisma, {
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    entityType: "result",
    entityId: input.resultId,
    eventType: input.eventType,
    title: input.title,
    body: input.body,
    payload: {
      ...input.payload,
      ...(assignee ? { assignedToUserId: assignee, notifyUserId: assignee } : { assignedToUserId: null })
    },
    notificationType: assignee ? "activity" : undefined
  });
}

export async function recordReportScheduleRunRequestedActivity(
  prisma: PrismaClient | undefined,
  input: {
    projectId: bigint;
    actorUserId?: bigint | null;
    scheduledReportId: bigint;
    reportType: string;
    name: string;
    manual: boolean;
  }
) {
  if (!prisma) return;
  await recordActivityEvent(prisma, {
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    entityType: "report",
    entityId: input.scheduledReportId,
    eventType: "report.schedule_run_requested",
    title: input.manual ? "Scheduled report run requested" : "Scheduled report run triggered",
    body: input.name,
    payload: {
      scheduledReportId: input.scheduledReportId.toString(),
      reportType: input.reportType,
      manual: input.manual
    }
  });
}
