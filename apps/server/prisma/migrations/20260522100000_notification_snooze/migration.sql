ALTER TABLE "Notification" ADD COLUMN "snoozedUntil" TIMESTAMP(3);

CREATE INDEX "Notification_userId_projectId_snoozedUntil_idx" ON "Notification"("userId", "projectId", "snoozedUntil");
