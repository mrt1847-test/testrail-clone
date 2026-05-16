import type { PrismaClient } from "@prisma/client";

import { executeScheduledReport } from "./scheduledReports.service.js";

export function startScheduledReportWorker(opts: { prisma: PrismaClient; intervalMs?: number }) {
  const intervalMs = opts.intervalMs ?? Number(process.env.SCHEDULED_REPORT_INTERVAL_MS ?? 60_000);
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = await opts.prisma.scheduledReport.findMany({
        where: {
          enabled: true,
          deletedAt: null,
          nextRunAt: { lte: new Date() }
        },
        orderBy: { nextRunAt: "asc" },
        take: 5
      });
      for (const row of due) {
        try {
          await executeScheduledReport(opts.prisma, row.id);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`scheduled report ${row.id.toString()} failed`, error);
        }
      }
    } finally {
      running = false;
    }
  };

  void tick();
  return setInterval(() => void tick(), intervalMs);
}
