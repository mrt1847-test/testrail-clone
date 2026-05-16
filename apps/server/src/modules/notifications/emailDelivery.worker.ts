import type { PrismaClient } from "@prisma/client";

import { sendEmailMessage } from "./emailTransport.js";
import { enqueueDigestEmails } from "./notificationEmail.service.js";

const MAX_ATTEMPTS = 5;

function backoffMs(attemptNo: number) {
  const base = 10_000 * 2 ** Math.max(0, attemptNo - 1);
  return Math.min(base, 3_600_000);
}

export function startEmailDeliveryWorker(opts: {
  prisma: PrismaClient;
  intervalMs?: number;
  digestIntervalMs?: number;
}) {
  const intervalMs = opts.intervalMs ?? Number(process.env.EMAIL_DELIVERY_INTERVAL_MS ?? 12_000);
  const digestIntervalMs = opts.digestIntervalMs ?? Number(process.env.EMAIL_DIGEST_INTERVAL_MS ?? 300_000);

  let emailTimer: ReturnType<typeof setInterval> | undefined;
  let digestTimer: ReturnType<typeof setInterval> | undefined;
  let digestRunning = false;

  const processOutbox = async () => {
    const pending = await opts.prisma.emailOutbox.findMany({
      where: {
        status: "pending",
        attemptNo: { lte: MAX_ATTEMPTS },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }]
      },
      orderBy: { id: "asc" },
      take: 15
    });

    for (const row of pending) {
      const result = await sendEmailMessage({
        to: row.recipientEmail,
        subject: row.subject,
        text: row.bodyText
      });

      if (result.ok) {
        await opts.prisma.emailOutbox.update({
          where: { id: row.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            error: null,
            nextRetryAt: null,
            updatedAt: new Date()
          }
        });
        continue;
      }

      const nextAttemptNo = row.attemptNo + 1;
      const failed = nextAttemptNo > MAX_ATTEMPTS;
      await opts.prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          attemptNo: nextAttemptNo,
          status: failed ? "failed" : "pending",
          error: result.error,
          nextRetryAt: failed ? null : new Date(Date.now() + backoffMs(nextAttemptNo)),
          updatedAt: new Date()
        }
      });
    }
  };

  const runDigest = async () => {
    if (digestRunning) return;
    digestRunning = true;
    try {
      await enqueueDigestEmails(opts.prisma);
      await processOutbox();
    } finally {
      digestRunning = false;
    }
  };

  const runOutbox = () => {
    void processOutbox().catch((e) => {
      const message = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error(`Email delivery worker failed: ${message}`);
    });
  };

  runOutbox();
  emailTimer = setInterval(runOutbox, intervalMs);

  void runDigest().catch((e) => {
    const message = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error(`Digest email enqueue failed: ${message}`);
  });
  digestTimer = setInterval(() => {
    void runDigest().catch((e) => {
      const message = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error(`Digest email enqueue failed: ${message}`);
    });
  }, digestIntervalMs);

  return () => {
    if (emailTimer) clearInterval(emailTimer);
    if (digestTimer) clearInterval(digestTimer);
  };
}
