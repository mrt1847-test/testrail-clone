import type { Prisma, PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";

import { queueEmailsForNotifications } from "../notifications/notificationEmail.service.js";
import { notifyTestSubscribers } from "../subscriptions/testSubscriptions.service.js";

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

const MENTION_TOKEN_RE = /(^|[\s([{"'])@([A-Za-z0-9._%+-]+(?:@[A-Za-z0-9.-]+\.[A-Za-z]{2,})?)/g;

function toRecord(value: Prisma.InputJsonValue | undefined): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function extractMentionTokens(text: string | null | undefined) {
  if (!text) return [];
  const tokens = new Set<string>();
  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    const token = match[2]?.trim().replace(/[.,;:!?]+$/g, "").toLowerCase();
    if (token) tokens.add(token);
  }
  return Array.from(tokens);
}

function userMatchesMentionToken(user: { email: string; name: string }, token: string) {
  const normalized = token.toLowerCase();
  const email = user.email.toLowerCase();
  const name = user.name.toLowerCase();
  const localPart = email.split("@")[0] ?? "";
  return normalized === email || normalized === localPart || normalized === name;
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
      deletedAt: null,
      isActive: true,
      OR: [
        { projectId: event.projectId, scope: "project" },
        { scope: "global" }
      ]
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
  const activityTargetId = toTargetUserId(
    payload.assignedToUserId ?? payload.assignedTo ?? payload.notifyUserId
  );
  const targetedRecipients =
    input.notificationType === "assignment" && assignmentTargetId
      ? recipients.filter((member) => member.userId === assignmentTargetId)
      : input.notificationType === "failed_result" && failureTargetId
        ? recipients.filter((member) => member.userId === failureTargetId)
        : input.notificationType === "activity" && activityTargetId
          ? recipients.filter((member) => member.userId === activityTargetId)
          : input.notificationType === "activity"
            ? []
            : recipients;

  const excludeIds: bigint[] = [];
  if (targetedRecipients.length > 0) {
    const notifications = await prisma.notification.createManyAndReturn({
      data: targetedRecipients.map((member) => ({
        userId: member.userId,
        projectId: input.projectId,
        activityEventId: event.id,
        type: input.notificationType!,
        title: input.title,
        body: input.body ?? null
      }))
    });
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { name: true }
    });
    await queueEmailsForNotifications(prisma, notifications, project?.name ?? "Project");
    excludeIds.push(...targetedRecipients.map((member) => member.userId));
  }

  const testId =
    input.entityType === "test" ? toTargetUserId(input.entityId) : toTargetUserId(payload.testId);
  if (testId && input.notificationType && input.notificationType !== "activity") {
    await notifyTestSubscribers(prisma, {
      projectId: input.projectId,
      testId,
      activityEventId: event.id,
      notificationType: input.notificationType,
      title: input.title,
      body: input.body,
      actorUserId: input.actorUserId,
      excludeUserIds: excludeIds
    });
  }

  return event;
}

async function queueMentionNotifications(
  prisma: PrismaClient,
  input: {
    event: Awaited<ReturnType<typeof prisma.activityEvent.create>>;
    projectId: bigint;
    actorUserId?: bigint | null;
    text?: string | null;
    title: string;
    body?: string | null;
  }
) {
  const tokens = extractMentionTokens(input.text);
  if (tokens.length === 0) return;

  const members = await prisma.projectMember.findMany({
    where: { projectId: input.projectId, deletedAt: null },
    select: {
      userId: true,
      user: {
        select: {
          email: true,
          name: true,
          notificationPreferences: {
            where: { projectId: input.projectId },
            select: { mentionEnabled: true }
          }
        }
      }
    }
  });

  const targets = members.filter((member) => {
    if (input.actorUserId && member.userId === input.actorUserId) return false;
    const preference = member.user.notificationPreferences[0];
    if (preference && !preference.mentionEnabled) return false;
    return tokens.some((token) => userMatchesMentionToken(member.user, token));
  });
  if (targets.length === 0) return;

  const notifications = await prisma.notification.createManyAndReturn({
    data: targets.map((member) => ({
      userId: member.userId,
      projectId: input.projectId,
      activityEventId: input.event.id,
      type: "mention",
      title: input.title,
      body: input.body ?? null
    }))
  });
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { name: true }
  });
  await queueEmailsForNotifications(prisma, notifications, project?.name ?? "Project");
}

export async function recordExecutionCommentActivity(
  prisma: PrismaClient,
  input: {
    commentId: bigint;
    projectId: bigint;
    entityType: "test_instance" | "test_run";
    entityId: bigint;
    content: string;
    actorUserId: bigint;
    contextTitle: string;
    runName?: string;
  }
) {
  const scopeLabel = input.entityType === "test_run" ? "run" : "test";
  const event = await recordActivityEvent(prisma, {
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    entityType: "execution_comment",
    entityId: input.commentId,
    eventType: "execution_comment.created",
    title: "Execution comment added",
    body: `${scopeLabel} discussion on ${input.contextTitle}`,
    payload: {
      commentId: input.commentId.toString(),
      entityType: input.entityType,
      entityId: input.entityId.toString(),
      runName: input.runName ?? null
    }
  });
  if (event) {
    await queueMentionNotifications(prisma, {
      event,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      text: input.content,
      title: "You were mentioned in a comment",
      body: `${input.contextTitle}: ${input.content}`
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
      comment: true,
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

  const event = await recordActivityEvent(prisma, {
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
  if (event && result.comment) {
    await queueMentionNotifications(prisma, {
      event,
      projectId: result.instance.run.projectId,
      actorUserId: input.actorUserId ?? null,
      text: result.comment,
      title: "You were mentioned in a result",
      body: `${result.instance.titleSnapshot}: ${result.comment}`
    });
  }
  return event;
}
