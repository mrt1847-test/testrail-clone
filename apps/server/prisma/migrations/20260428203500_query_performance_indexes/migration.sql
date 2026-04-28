CREATE INDEX "TestCase_projectId_sectionId_deletedAt_idx" ON "TestCase"("projectId", "sectionId", "deletedAt");
CREATE INDEX "TestRun_projectId_status_createdAt_idx" ON "TestRun"("projectId", "status", "createdAt");
CREATE INDEX "TestInstance_runId_status_idx" ON "TestInstance"("runId", "status");
CREATE INDEX "TestResult_status_createdAt_idx" ON "TestResult"("status", "createdAt");
CREATE INDEX "TestResult_source_createdAt_idx" ON "TestResult"("source", "createdAt");
