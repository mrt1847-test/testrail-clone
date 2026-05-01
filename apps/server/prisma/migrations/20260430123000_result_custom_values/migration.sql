ALTER TABLE "TestResult" ADD COLUMN "customValues" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "CustomField" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'case';

CREATE INDEX "CustomField_projectId_scope_isActive_displayOrder_idx" ON "CustomField"("projectId", "scope", "isActive", "displayOrder");
