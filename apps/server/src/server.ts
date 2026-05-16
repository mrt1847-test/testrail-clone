import { buildApp } from "./app.js";
import { describeDatabaseUrl, env } from "./config/env.js";
import { getPrismaClient } from "./db/prisma.js";
import { startEmailDeliveryWorker } from "./modules/notifications/emailDelivery.worker.js";
import { startScheduledReportWorker } from "./modules/reports/scheduledReport.worker.js";
import { startWebhookDeliveryWorker } from "./modules/settings/webhookDelivery.worker.js";

const app = buildApp();

if (!env.useInMemoryRepository) {
  const prisma = getPrismaClient();
  startWebhookDeliveryWorker({ prisma });
  startEmailDeliveryWorker({ prisma });
  startScheduledReportWorker({ prisma });
}

// eslint-disable-next-line no-console
console.log(`Starting server on port ${env.port}`);
// eslint-disable-next-line no-console
console.log(`Database connection: ${describeDatabaseUrl(env.databaseUrl)}`);

app.listen({ port: env.port, host: "0.0.0.0" }).then(() => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${env.port}`);
}).catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
