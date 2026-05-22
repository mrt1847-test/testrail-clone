import type { PrismaClient } from "@prisma/client";

import {
  getDefaultWebhookDisableThreshold,
  resolveWebhookDisableThreshold
} from "../../domain/webhookDeliveryPolicy.js";

export const WEBHOOK_DISABLE_FAILURE_THRESHOLD = getDefaultWebhookDisableThreshold();

export async function resolveProjectWebhookDisableThreshold(
  prisma: PrismaClient,
  projectId: bigint
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { webhookDisableFailureThreshold: true }
  });
  return resolveWebhookDisableThreshold(project?.webhookDisableFailureThreshold);
}

export async function recordWebhookDeliverySuccess(prisma: PrismaClient, webhookId: bigint) {
  await prisma.webhookSubscription.updateMany({
    where: { id: webhookId, consecutiveFailures: { gt: 0 } },
    data: {
      consecutiveFailures: 0,
      lastFailureAt: null,
      updatedAt: new Date()
    }
  });
}

export async function recordWebhookDeliveryFailure(prisma: PrismaClient, webhookId: bigint) {
  const webhook = await prisma.webhookSubscription.findFirst({
    where: { id: webhookId, deletedAt: null },
    select: { id: true, consecutiveFailures: true, isActive: true, projectId: true }
  });
  if (!webhook || !webhook.isActive) return;

  const threshold = await resolveProjectWebhookDisableThreshold(prisma, webhook.projectId);
  const nextFailures = webhook.consecutiveFailures + 1;
  const shouldDisable = nextFailures >= threshold;
  await prisma.webhookSubscription.update({
    where: { id: webhook.id },
    data: {
      consecutiveFailures: nextFailures,
      lastFailureAt: new Date(),
      ...(shouldDisable
        ? {
            isActive: false,
            disabledAt: new Date()
          }
        : {}),
      updatedAt: new Date()
    }
  });
}
