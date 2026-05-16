-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN "lastDigestSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "nextRetryAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "notificationIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextRetryAt_createdAt_idx" ON "EmailOutbox"("status", "nextRetryAt", "createdAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_userId_projectId_kind_createdAt_idx" ON "EmailOutbox"("userId", "projectId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
