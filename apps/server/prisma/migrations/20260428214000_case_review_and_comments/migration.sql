ALTER TABLE "TestCase" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';

CREATE TABLE "TestCaseComment" (
  "id" BIGSERIAL PRIMARY KEY,
  "caseId" BIGINT NOT NULL REFERENCES "TestCase"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "createdBy" BIGINT NULL REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL
);

CREATE INDEX "TestCaseComment_caseId_createdAt_idx" ON "TestCaseComment"("caseId", "createdAt");
