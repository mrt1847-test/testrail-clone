ALTER TABLE "TestCase" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "TestCase_projectId_archivedAt_deletedAt_idx" ON "TestCase"("projectId", "archivedAt", "deletedAt");
