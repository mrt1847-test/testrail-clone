import type { PrismaClient } from "@prisma/client";

export const WEBHOOK_DISABLE_FAILURE_THRESHOLD = Number(
  process.env.WEBHOOK_DISABLE_FAILURE_THRESHOLD ?? 5
);

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
    select: { id: true, consecutiveFailures: true, isActive: true }
  });
  if (!webhook || !webhook.isActive) return;

  const nextFailures = webhook.consecutiveFailures + 1;
  const shouldDisable = nextFailures >= WEBHOOK_DISABLE_FAILURE_THRESHOLD;
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
