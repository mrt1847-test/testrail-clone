import type { PrismaClient } from "@prisma/client";

const MAX_ATTEMPTS = 8;

function backoffMs(attemptNo: number) {
  const base = 5000 * 2 ** Math.max(0, attemptNo - 1);
  return Math.min(base, 3_600_000);
}

function truncateBody(text: string, max = 4000) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function startWebhookDeliveryWorker(opts: { prisma: PrismaClient; intervalMs?: number }) {
  const intervalMs = opts.intervalMs ?? Number(process.env.WEBHOOK_DELIVERY_INTERVAL_MS ?? 8000);
  let timer: ReturnType<typeof setInterval> | undefined;

  const tick = async () => {
    const pending = await opts.prisma.webhookDeliveryAttempt.findMany({
      where: {
        status: "pending",
        attemptNo: { lte: MAX_ATTEMPTS },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }]
      },
      orderBy: { id: "asc" },
      take: 10
    });
    for (const attempt of pending) {
      const webhook = await opts.prisma.webhookSubscription.findFirst({
        where: { id: attempt.webhookId, deletedAt: null, isActive: true }
      });
      if (!webhook) {
        await opts.prisma.webhookDeliveryAttempt.update({
          where: { id: attempt.id },
          data: { status: "failed", error: "webhook missing or inactive", updatedAt: new Date() }
        });
        continue;
      }
      const body = JSON.stringify(attempt.payload);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25_000);
        let res: Response;
        try {
          res = await fetch(attempt.targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Signature": attempt.signature,
              "X-Webhook-Event": attempt.event
            },
            body,
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeout);
        }
        const responseText = truncateBody(await res.text());
        if (res.ok) {
          await opts.prisma.webhookDeliveryAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "delivered",
              responseStatus: res.status,
              responseBody: responseText,
              deliveredAt: new Date(),
              error: null,
              nextRetryAt: null,
              updatedAt: new Date()
            }
          });
        } else {
          const nextAttemptNo = attempt.attemptNo + 1;
          const next = new Date(Date.now() + backoffMs(nextAttemptNo));
          await opts.prisma.webhookDeliveryAttempt.update({
            where: { id: attempt.id },
            data: {
              attemptNo: nextAttemptNo,
              status: nextAttemptNo > MAX_ATTEMPTS ? "failed" : "pending",
              responseStatus: res.status,
              responseBody: responseText,
              error: `http ${String(res.status)}`,
              nextRetryAt: nextAttemptNo > MAX_ATTEMPTS ? null : next,
              updatedAt: new Date()
            }
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "unknown error";
        const nextAttemptNo = attempt.attemptNo + 1;
        const next = new Date(Date.now() + backoffMs(nextAttemptNo));
        await opts.prisma.webhookDeliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            attemptNo: nextAttemptNo,
            status: nextAttemptNo > MAX_ATTEMPTS ? "failed" : "pending",
            error: truncateBody(message, 2000),
            nextRetryAt: nextAttemptNo > MAX_ATTEMPTS ? null : next,
            updatedAt: new Date()
          }
        });
      }
    }
  };

  void tick();
  timer = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => {
    if (timer) clearInterval(timer);
  };
}
