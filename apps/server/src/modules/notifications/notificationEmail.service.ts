import type { Notification, PrismaClient } from "@prisma/client";

import { env } from "../../config/env.js";
import { buildDigestBodyForTest, shouldSendImmediateEmail, type EmailPreferenceInput } from "./notificationEmail.helpers.js";
import { sendEmailMessage } from "./emailTransport.js";

const MAX_DIGEST_ITEMS = 50;

type PreferenceRow = EmailPreferenceInput & {
  lastDigestSentAt: Date | null;
};

function typeAllowed(type: string, preference: EmailPreferenceInput) {
  return shouldSendImmediateEmail({ ...preference, digestEnabled: false }, type);
}

function buildImmediateBody(notification: Pick<Notification, "title" | "body" | "type">, projectName: string) {
  const lines = [
    `Project: ${projectName}`,
    `Type: ${notification.type}`,
    notification.title,
    notification.body ?? ""
  ].filter(Boolean);
  return lines.join("\n");
}

function buildDigestBody(
  projectName: string,
  notifications: Array<Pick<Notification, "title" | "body" | "type" | "createdAt">>
) {
  return buildDigestBodyForTest(projectName, notifications);
}

export async function queueEmailsForNotifications(
  prisma: PrismaClient,
  notifications: Notification[],
  projectName: string
) {
  if (notifications.length === 0 || env.emailDeliveryMode === "disabled") return;

  const userIds = [...new Set(notifications.map((row) => row.userId))];
  const projectId = notifications[0]!.projectId;

  const [users, preferences] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null },
      select: { id: true, email: true }
    }),
    prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, projectId },
      select: {
        userId: true,
        assignmentEnabled: true,
        failedResultEnabled: true,
        mentionEnabled: true,
        digestEnabled: true,
        lastDigestSentAt: true
      }
    })
  ]);

  const userById = new Map(users.map((row) => [row.id, row]));
  const preferenceByUser = new Map(preferences.map((row) => [row.userId, row]));

  const outboxRows: Array<{
    userId: bigint;
    projectId: bigint;
    recipientEmail: string;
    kind: string;
    subject: string;
    bodyText: string;
    notificationIds: string[];
  }> = [];

  for (const notification of notifications) {
    const user = userById.get(notification.userId);
    if (!user?.email) continue;

    const preference: PreferenceRow = preferenceByUser.get(notification.userId) ?? {
      assignmentEnabled: true,
      failedResultEnabled: true,
      mentionEnabled: true,
      digestEnabled: false,
      lastDigestSentAt: null
    };

    if (!shouldSendImmediateEmail(preference, notification.type)) continue;

    outboxRows.push({
      userId: notification.userId,
      projectId: notification.projectId,
      recipientEmail: user.email,
      kind: "immediate",
      subject: `[TestRail Clone] ${notification.title}`,
      bodyText: buildImmediateBody(notification, projectName),
      notificationIds: [notification.id.toString()]
    });
  }

  if (outboxRows.length === 0) return;

  await prisma.emailOutbox.createMany({
    data: outboxRows.map((row) => ({
      userId: row.userId,
      projectId: row.projectId,
      recipientEmail: row.recipientEmail,
      kind: row.kind,
      subject: row.subject,
      bodyText: row.bodyText,
      notificationIds: row.notificationIds,
      status: "pending"
    }))
  });
}

export async function enqueueDigestEmails(prisma: PrismaClient) {
  if (env.emailDeliveryMode === "disabled") return;

  const preferences = await prisma.notificationPreference.findMany({
    where: { digestEnabled: true },
    select: {
      userId: true,
      projectId: true,
      lastDigestSentAt: true,
      assignmentEnabled: true,
      failedResultEnabled: true,
      mentionEnabled: true,
      digestEnabled: true,
      user: { select: { email: true, deletedAt: true } },
      project: { select: { name: true, deletedAt: true } }
    }
  });

  for (const preference of preferences) {
    if (preference.user.deletedAt || preference.project.deletedAt || !preference.user.email) continue;

    const since = preference.lastDigestSentAt ?? new Date(0);
    const notifications = await prisma.notification.findMany({
      where: {
        userId: preference.userId,
        projectId: preference.projectId,
        createdAt: { gt: since }
      },
      orderBy: { createdAt: "asc" },
      take: MAX_DIGEST_ITEMS
    });

    const filtered = notifications.filter((row) => typeAllowed(row.type, preference));
    if (filtered.length === 0) continue;

    const digestSentAt = new Date();
    await prisma.$transaction([
      prisma.emailOutbox.create({
        data: {
          userId: preference.userId,
          projectId: preference.projectId,
          recipientEmail: preference.user.email,
          kind: "digest",
          subject: `[TestRail Clone] ${preference.project.name} digest (${filtered.length})`,
          bodyText: buildDigestBody(preference.project.name, filtered),
          notificationIds: filtered.map((row) => row.id.toString()),
          status: "pending"
        }
      }),
      prisma.notificationPreference.update({
        where: {
          userId_projectId: {
            userId: preference.userId,
            projectId: preference.projectId
          }
        },
        data: { lastDigestSentAt: digestSentAt }
      })
    ]);
  }
}
