import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { getPrismaClient } from "./db/prisma.js";
import { startWebhookDeliveryWorker } from "./modules/settings/webhookDelivery.worker.js";

const app = buildApp();

if (!env.useInMemoryRepository) {
  const prisma = getPrismaClient();
  startWebhookDeliveryWorker({ prisma });
}

// eslint-disable-next-line no-console
console.log(`Starting server on port ${env.port}`);

app.listen({ port: env.port, host: "0.0.0.0" }).then(() => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${env.port}`);
}).catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
