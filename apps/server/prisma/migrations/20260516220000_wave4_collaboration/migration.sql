-- Webhook auto-disable tracking
ALTER TABLE "WebhookSubscription" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WebhookSubscription" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "WebhookSubscription" ADD COLUMN "lastFailureAt" TIMESTAMP(3);

-- Per-test email subscriptions
CREATE TABLE "TestSubscription" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "testId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TestSubscription_userId_testId_key" ON "TestSubscription"("userId", "testId");
CREATE INDEX "TestSubscription_testId_idx" ON "TestSubscription"("testId");
CREATE INDEX "TestSubscription_projectId_userId_idx" ON "TestSubscription"("projectId", "userId");

ALTER TABLE "TestSubscription" ADD CONSTRAINT "TestSubscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSubscription" ADD CONSTRAINT "TestSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSubscription" ADD CONSTRAINT "TestSubscription_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
