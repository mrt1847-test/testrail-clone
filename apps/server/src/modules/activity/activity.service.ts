import type { Prisma, PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";

type NotificationType = "assignment" | "failed_result" | "mention" | "activity";

type ActivityInput = {
  projectId: bigint;
  actorUserId?: bigint | null;
  entityType: string;
  entityId: bigint | string;
  eventType: string;
  title: string;
  body?: string | null;
  payload?: Prisma.InputJsonValue;
  notificationType?: NotificationType;
};

function toRecord(value: Prisma.InputJsonValue | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toTargetUserId(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && value.trim().length > 0 && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return null;
}

function preferenceEnabled(
  type: NotificationType,
  preference?: {
    assignmentEnabled: boolean;
    failedResultEnabled: boolean;
    mentionEnabled: boolean;
  }
) {
  if (!preference) return true;
  if (type === "assignment") return preference.assignmentEnabled;
  if (type === "failed_result") return preference.failedResultEnabled;
  if (type === "mention") return preference.mentionEnabled;
  return true;
}

function eventMatches(pattern: string, eventType: string) {
  if (pattern === "*" || pattern === eventType) return true;
  if (pattern.endsWith(".*")) return eventType.startsWith(pattern.slice(0, -1));
  return false;
}

function webhookPayload(event: {
  id: bigint;
  projectId: bigint;
  actorUserId: bigint | null;
  entityType: string;
  entityId: string;
  eventType: string;
  title: string;
  body: string | null;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: event.id.toString(),
    projectId: event.projectId.toString(),
    actorUserId: event.actorUserId?.toString() ?? null,
    entityType: event.entityType,
    entityId: event.entityId,
    eventType: event.eventType,
    title: event.title,
    body: event.body,
    payload: event.payload,
    createdAt: event.createdAt.toISOString()
  };
}

function signWebhookPayload(secret: string, payload: unknown) {
  const body = JSON.stringify(payload);
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function queueWebhookDeliveryAttempts(prisma: PrismaClient, event: Awaited<ReturnType<typeof prisma.activityEvent.create>>) {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      projectId: event.projectId,
      deletedAt: null,
      isActive: true
    },
    select: {
      id: true,
      event: true,
      targetUrl: true,
      secret: true
    }
  });
  const matched = subscriptions.filter((subscription) => eventMatches(subscription.event, event.eventType));
  if (matched.length === 0) return;
  const payload = webhookPayload(event);
  await prisma.webhookDeliveryAttempt.createMany({
    data: matched.map((subscription) => ({
      projectId: event.projectId,
      webhookId: subscription.id,
      activityEventId: event.id,
      event: event.eventType,
      targetUrl: subscription.targetUrl,
      payload: payload as Prisma.InputJsonValue,
      signature: signWebhookPayload(subscription.secret, payload),
      status: "pending"
    }))
  });
}

export async function recordActivityEvent(prisma: PrismaClient | undefined, input: ActivityInput) {
  if (!prisma) return null;

  const event = await prisma.activityEvent.create({
    data: {
      projectId: input.projectId,
      actorUserId: input.actorUserId ?? null,
      entityType: input.entityType,
      entityId: String(input.entityId),
      eventType: input.eventType,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload ?? undefined
    }
  });

  await queueWebhookDeliveryAttempts(prisma, event);

  if (!input.notificationType) return event;

  const members = await prisma.projectMember.findMany({
    where: { projectId: input.projectId, deletedAt: null },
    select: {
      userId: true,
      user: {
        select: {
          notificationPreferences: {
            where: { projectId: input.projectId },
            select: {
              assignmentEnabled: true,
              failedResultEnabled: true,
              mentionEnabled: true
            }
          }
        }
      }
    }
  });

  const recipients = members.filter((member) => {
    if (input.actorUserId && member.userId === input.actorUserId && input.notificationType !== "assignment") {
      return false;
    }
    return preferenceEnabled(input.notificationType!, member.user.notificationPreferences[0]);
  });

  const payload = toRecord(input.payload);
  const assignmentTargetId = toTargetUserId(payload.assignedToUserId ?? payload.assignedTo);
  const failureTargetId = toTargetUserId(payload.assignedToUserId ?? payload.assignedTo);
  const targetedRecipients =
    input.notificationType === "assignment" && assignmentTargetId
      ? recipients.filter((member) => member.userId === assignmentTargetId)
      : input.notificationType === "failed_result" && failureTargetId
        ? recipients.filter((member) => member.userId === failureTargetId)
        : recipients;

  if (targetedRecipients.length > 0) {
    await prisma.notification.createMany({
      data: targetedRecipients.map((member) => ({
        userId: member.userId,
        projectId: input.projectId,
        activityEventId: event.id,
        type: input.notificationType!,
        title: input.title,
        body: input.body ?? null
      }))
    });
  }

  return event;
}

export async function recordResultActivity(
  prisma: PrismaClient | undefined,
  input: { resultId: bigint; actorUserId?: bigint | null }
) {
  if (!prisma) return null;
  const result = await prisma.testResult.findUnique({
    where: { id: input.resultId },
    select: {
      id: true,
      status: true,
      instance: {
        select: {
          id: true,
          caseId: true,
          assignedTo: true,
          titleSnapshot: true,
          run: { select: { id: true, name: true, projectId: true } }
        }
      }
    }
  });
  if (!result) return null;

  return recordActivityEvent(prisma, {
    projectId: result.instance.run.projectId,
    actorUserId: input.actorUserId ?? null,
    entityType: "result",
    entityId: result.id,
    eventType: result.status === "failed" ? "result.failed" : "result.created",
    title: result.status === "failed" ? "Failed result added" : "Result added",
    body: `${result.instance.titleSnapshot} in ${result.instance.run.name} was marked ${result.status}.`,
    payload: {
      resultId: result.id.toString(),
      testId: result.instance.id.toString(),
      caseId: result.instance.caseId.toString(),
      runId: result.instance.run.id.toString(),
      status: result.status,
      assignedToUserId: result.instance.assignedTo?.toString() ?? null
    },
    notificationType: result.status === "failed" ? "failed_result" : undefined
  });
}
