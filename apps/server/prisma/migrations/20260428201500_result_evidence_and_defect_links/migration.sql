ALTER TABLE "Attachment"
  ADD COLUMN "resultId" BIGINT NULL;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_resultId_fkey"
  FOREIGN KEY ("resultId") REFERENCES "TestResult"("id") ON DELETE CASCADE;

CREATE TABLE "ResultDefectLink" (
  "id" BIGSERIAL PRIMARY KEY,
  "resultId" BIGINT NOT NULL REFERENCES "TestResult"("id") ON DELETE CASCADE,
  "defectKey" TEXT NOT NULL,
  "url" TEXT NULL,
  "createdBy" BIGINT NULL REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  UNIQUE ("resultId", "defectKey")
);

CREATE INDEX "ResultDefectLink_resultId_createdAt_idx" ON "ResultDefectLink"("resultId", "createdAt");
