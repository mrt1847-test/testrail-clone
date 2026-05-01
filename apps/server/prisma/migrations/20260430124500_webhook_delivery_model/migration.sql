CREATE TABLE "WebhookSubscription" (
  "id" BIGSERIAL NOT NULL,
  "projectId" BIGINT NOT NULL,
  "event" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdBy" BIGINT,
  "updatedBy" BIGINT,
  CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookDeliveryAttempt" (
  "id" BIGSERIAL NOT NULL,
  "projectId" BIGINT NOT NULL,
  "webhookId" BIGINT NOT NULL,
  "activityEventId" BIGINT,
  "event" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signature" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attemptNo" INTEGER NOT NULL DEFAULT 1,
  "responseStatus" INTEGER,
  "responseBody" TEXT,
  "error" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookSubscription_projectId_isActive_event_idx" ON "WebhookSubscription"("projectId", "isActive", "event");
CREATE INDEX "WebhookSubscription_projectId_deletedAt_idx" ON "WebhookSubscription"("projectId", "deletedAt");
CREATE INDEX "WebhookDeliveryAttempt_projectId_status_createdAt_idx" ON "WebhookDeliveryAttempt"("projectId", "status", "createdAt");
CREATE INDEX "WebhookDeliveryAttempt_webhookId_createdAt_idx" ON "WebhookDeliveryAttempt"("webhookId", "createdAt");
CREATE INDEX "WebhookDeliveryAttempt_activityEventId_idx" ON "WebhookDeliveryAttempt"("activityEventId");

ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDeliveryAttempt" ADD CONSTRAINT "WebhookDeliveryAttempt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDeliveryAttempt" ADD CONSTRAINT "WebhookDeliveryAttempt_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDeliveryAttempt" ADD CONSTRAINT "WebhookDeliveryAttempt_activityEventId_fkey" FOREIGN KEY ("activityEventId") REFERENCES "ActivityEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
