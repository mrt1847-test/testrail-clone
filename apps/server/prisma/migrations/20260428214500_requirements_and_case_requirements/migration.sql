CREATE TABLE "Requirement" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "externalUrl" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  UNIQUE ("projectId", "key")
);

CREATE INDEX "Requirement_projectId_status_idx" ON "Requirement"("projectId", "status");

CREATE TABLE "CaseRequirement" (
  "id" BIGSERIAL PRIMARY KEY,
  "caseId" BIGINT NOT NULL REFERENCES "TestCase"("id") ON DELETE CASCADE,
  "requirementId" BIGINT NOT NULL REFERENCES "Requirement"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("caseId", "requirementId")
);

CREATE INDEX "CaseRequirement_requirementId_caseId_idx" ON "CaseRequirement"("requirementId", "caseId");
