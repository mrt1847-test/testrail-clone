CREATE TABLE "TestCaseVersion" (
  "id" BIGSERIAL PRIMARY KEY,
  "caseId" BIGINT NOT NULL REFERENCES "TestCase"("id") ON DELETE CASCADE,
  "versionNo" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "priority" TEXT NULL,
  "caseType" TEXT NULL,
  "preconditions" TEXT NULL,
  "stepsSnapshot" JSONB NOT NULL,
  "changeReason" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("caseId", "versionNo")
);

CREATE INDEX "TestCaseVersion_caseId_createdAt_idx" ON "TestCaseVersion"("caseId", "createdAt");
