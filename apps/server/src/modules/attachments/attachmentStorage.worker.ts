import type { PrismaClient } from "@prisma/client";

import { env } from "../../config/env.js";
import { backfillTombstonedStoragePaths } from "./attachmentLifecycle.service.js";
import { runScheduledAttachmentRetentionPrune } from "./attachmentRetention.service.js";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

export function startAttachmentStorageWorker(deps: { prisma: PrismaClient; intervalMs?: number }) {
  const intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS;

  const tick = async () => {
    try {
      let total = 0;
      for (let pass = 0; pass < 10; pass += 1) {
        const updated = await backfillTombstonedStoragePaths(deps.prisma, 100);
        total += updated;
        if (updated < 100) break;
      }
      if (total > 0) {
        // eslint-disable-next-line no-console
        console.log(`Attachment storage worker tombstoned ${total} deleted attachment path(s).`);
      }

      const pruned = await runScheduledAttachmentRetentionPrune(deps.prisma);
      if (pruned.deleted > 0 || pruned.tombstoneBackfilled > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `Attachment retention worker pruned ${pruned.deleted} row(s) (default ${env.attachmentRetentionDaysDefault}d), tombstone backfill ${pruned.tombstoneBackfilled}.`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(`Attachment storage worker failed: ${message}`);
    }
  };

  void tick();
  return setInterval(() => void tick(), intervalMs);
}
