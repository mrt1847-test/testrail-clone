import type { Notification, PrismaClient } from "@prisma/client";

import { queueEmailsForNotifications } from "../notifications/notificationEmail.service.js";

type NotificationType = "assignment" | "failed_result" | "mention";

export async function listSubscribedTestIdsForRun(
  prisma: PrismaClient,
  input: { runId: bigint; userId: bigint }
) {
  const rows = await prisma.testSubscription.findMany({
    where: {
      userId: input.userId,
      test: { runId: input.runId, deletedAt: null }
    },
    select: { testId: true }
  });
  return rows.map((row) => row.testId);
}

export async function setTestSubscription(
  prisma: PrismaClient,
  input: { projectId: bigint; userId: bigint; testId: bigint; subscribed: boolean }
) {
  const test = await prisma.testInstance.findFirst({
    where: { id: input.testId, deletedAt: null },
    select: { id: true, run: { select: { projectId: true } } }
  });
  if (!test || test.run.projectId !== input.projectId) {
    throw new Error("TEST_NOT_FOUND");
  }

  if (!input.subscribed) {
    await prisma.testSubscription.deleteMany({
      where: { userId: input.userId, testId: input.testId }
    });
    return { subscribed: false, testId: input.testId };
  }

  await prisma.testSubscription.upsert({
    where: {
      userId_testId: { userId: input.userId, testId: input.testId }
    },
    create: {
      projectId: input.projectId,
      userId: input.userId,
      testId: input.testId
    },
    update: {}
  });
  return { subscribed: true, testId: input.testId };
}

export async function notifyTestSubscribers(
  prisma: PrismaClient,
  input: {
    projectId: bigint;
    testId: bigint;
    activityEventId: bigint;
    notificationType: NotificationType;
    title: string;
    body?: string | null;
    actorUserId?: bigint | null;
    excludeUserIds?: bigint[];
  }
) {
  const subscribers = await prisma.testSubscription.findMany({
    where: { testId: input.testId, projectId: input.projectId },
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

  const excluded = new Set(
    (input.excludeUserIds ?? []).map((id) => id.toString()).concat(
      input.actorUserId ? [input.actorUserId.toString()] : []
    )
  );

  const recipientIds = subscribers
    .map((row) => row.userId)
    .filter((userId) => !excluded.has(userId.toString()));

  if (recipientIds.length === 0) return;

  const preferenceEnabled = (type: NotificationType, preference?: {
    assignmentEnabled: boolean;
    failedResultEnabled: boolean;
    mentionEnabled: boolean;
  }) => {
    if (!preference) return true;
    if (type === "assignment") return preference.assignmentEnabled;
    if (type === "failed_result") return preference.failedResultEnabled;
    return preference.mentionEnabled;
  };

  const eligible = subscribers.filter(
    (row) =>
      recipientIds.some((id) => id === row.userId) &&
      preferenceEnabled(input.notificationType, row.user.notificationPreferences[0])
  );

  if (eligible.length === 0) return;

  const notifications: Notification[] = await prisma.notification.createManyAndReturn({
    data: eligible.map((row) => ({
      userId: row.userId,
      projectId: input.projectId,
      activityEventId: input.activityEventId,
      type: input.notificationType,
      title: `[Subscribed] ${input.title}`,
      body: input.body ?? null
    }))
  });

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { name: true }
  });
  await queueEmailsForNotifications(prisma, notifications, project?.name ?? "Project");
}
