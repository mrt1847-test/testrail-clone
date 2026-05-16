ALTER TABLE "WebhookSubscription" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'project';

CREATE INDEX "WebhookSubscription_scope_isActive_event_idx" ON "WebhookSubscription"("scope", "isActive", "event");
