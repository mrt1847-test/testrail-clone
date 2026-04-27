-- Initial schema for Phase 1 core domain.
-- NOTE: This SQL mirrors prisma/schema.prisma and is kept explicit
-- because Prisma engine download can fail in restricted corporate networks.

CREATE TYPE "TestStatus" AS ENUM ('untested', 'passed', 'failed', 'blocked', 'retest');

CREATE TABLE "User" (
  "id" BIGSERIAL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL
);

CREATE TABLE "Project" (
  "id" BIGSERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL REFERENCES "User" ("id") ON DELETE SET NULL,
  "updatedBy" BIGINT NULL REFERENCES "User" ("id") ON DELETE SET NULL
);
CREATE INDEX "Project_deletedAt_idx" ON "Project" ("deletedAt");

CREATE TABLE "ProjectMember" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project" ("id") ON DELETE RESTRICT,
  "userId" BIGINT NOT NULL REFERENCES "User" ("id") ON DELETE RESTRICT,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL,
  UNIQUE ("projectId", "userId")
);
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember" ("projectId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember" ("userId");

CREATE TABLE "TestSuite" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project" ("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "description" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL
);
CREATE INDEX "TestSuite_projectId_idx" ON "TestSuite" ("projectId");
CREATE INDEX "TestSuite_deletedAt_idx" ON "TestSuite" ("deletedAt");

CREATE TABLE "Section" (
  "id" BIGSERIAL PRIMARY KEY,
  "suiteId" BIGINT NOT NULL REFERENCES "TestSuite" ("id") ON DELETE RESTRICT,
  "parentSectionId" BIGINT NULL REFERENCES "Section" ("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL
);
CREATE INDEX "Section_suiteId_idx" ON "Section" ("suiteId");
CREATE INDEX "Section_parentSectionId_idx" ON "Section" ("parentSectionId");

CREATE TABLE "TestCase" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project" ("id") ON DELETE RESTRICT,
  "suiteId" BIGINT NOT NULL REFERENCES "TestSuite" ("id") ON DELETE RESTRICT,
  "sectionId" BIGINT NOT NULL REFERENCES "Section" ("id") ON DELETE RESTRICT,
  "title" TEXT NOT NULL,
  "preconditions" TEXT NULL,
  "expectedResult" TEXT NULL,
  "priority" TEXT NULL,
  "caseType" TEXT NULL,
  "estimate" TEXT NULL,
  "refs" TEXT NULL,
  "labels" TEXT[] NOT NULL DEFAULT '{}',
  "automationKey" TEXT NULL,
  "externalId" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL,
  UNIQUE ("projectId", "automationKey"),
  UNIQUE ("projectId", "externalId")
);
CREATE INDEX "TestCase_projectId_idx" ON "TestCase" ("projectId");
CREATE INDEX "TestCase_sectionId_idx" ON "TestCase" ("sectionId");
CREATE INDEX "TestCase_automationKey_idx" ON "TestCase" ("automationKey");
CREATE INDEX "TestCase_externalId_idx" ON "TestCase" ("externalId");

CREATE TABLE "TestCaseStep" (
  "id" BIGSERIAL PRIMARY KEY,
  "caseId" BIGINT NOT NULL REFERENCES "TestCase" ("id") ON DELETE CASCADE,
  "stepOrder" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "expectedResult" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL,
  UNIQUE ("caseId", "stepOrder")
);
CREATE INDEX "TestCaseStep_caseId_idx" ON "TestCaseStep" ("caseId");

CREATE TABLE "Milestone" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project" ("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "description" TEXT NULL,
  "startDate" TIMESTAMPTZ NULL,
  "dueDate" TIMESTAMPTZ NULL,
  "isCompleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL
);
CREATE INDEX "Milestone_projectId_idx" ON "Milestone" ("projectId");

CREATE TABLE "TestPlan" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project" ("id") ON DELETE RESTRICT,
  "milestoneId" BIGINT NULL REFERENCES "Milestone" ("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL
);
CREATE INDEX "TestPlan_projectId_idx" ON "TestPlan" ("projectId");
CREATE INDEX "TestPlan_milestoneId_idx" ON "TestPlan" ("milestoneId");

CREATE TABLE "TestRun" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project" ("id") ON DELETE RESTRICT,
  "suiteId" BIGINT NOT NULL REFERENCES "TestSuite" ("id") ON DELETE RESTRICT,
  "milestoneId" BIGINT NULL REFERENCES "Milestone" ("id") ON DELETE SET NULL,
  "planId" BIGINT NULL REFERENCES "TestPlan" ("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NULL,
  "includeAll" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" TEXT NOT NULL DEFAULT 'open',
  "assignedTo" BIGINT NULL REFERENCES "User" ("id") ON DELETE SET NULL,
  "environment" TEXT NULL,
  "startedAt" TIMESTAMPTZ NULL,
  "closedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL
);
CREATE INDEX "TestRun_projectId_idx" ON "TestRun" ("projectId");
CREATE INDEX "TestRun_suiteId_idx" ON "TestRun" ("suiteId");
CREATE INDEX "TestRun_milestoneId_idx" ON "TestRun" ("milestoneId");
CREATE INDEX "TestRun_status_idx" ON "TestRun" ("status");

CREATE TABLE "TestResult" (
  "id" BIGSERIAL PRIMARY KEY,
  "testInstanceId" BIGINT NOT NULL,
  "status" "TestStatus" NOT NULL,
  "comment" TEXT NULL,
  "elapsed" TEXT NULL,
  "version" TEXT NULL,
  "defects" TEXT[] NOT NULL DEFAULT '{}',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdBy" BIGINT NULL REFERENCES "User" ("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "TestInstance" (
  "id" BIGSERIAL PRIMARY KEY,
  "runId" BIGINT NOT NULL REFERENCES "TestRun" ("id") ON DELETE CASCADE,
  "caseId" BIGINT NOT NULL REFERENCES "TestCase" ("id") ON DELETE RESTRICT,
  "status" "TestStatus" NOT NULL DEFAULT 'untested',
  "titleSnapshot" TEXT NOT NULL,
  "prioritySnapshot" TEXT NULL,
  "typeSnapshot" TEXT NULL,
  "estimateSnapshot" TEXT NULL,
  "automationKeySnapshot" TEXT NULL,
  "externalIdSnapshot" TEXT NULL,
  "latestResultId" BIGINT NULL REFERENCES "TestResult" ("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL,
  UNIQUE ("runId", "caseId")
);
CREATE INDEX "TestInstance_runId_idx" ON "TestInstance" ("runId");
CREATE INDEX "TestInstance_caseId_idx" ON "TestInstance" ("caseId");
CREATE INDEX "TestInstance_status_idx" ON "TestInstance" ("status");
CREATE INDEX "TestInstance_automationKeySnapshot_idx" ON "TestInstance" ("automationKeySnapshot");
CREATE INDEX "TestInstance_externalIdSnapshot_idx" ON "TestInstance" ("externalIdSnapshot");

ALTER TABLE "TestResult"
  ADD CONSTRAINT "TestResult_testInstanceId_fkey"
  FOREIGN KEY ("testInstanceId") REFERENCES "TestInstance" ("id") ON DELETE CASCADE;

CREATE INDEX "TestResult_testInstanceId_createdAt_idx" ON "TestResult" ("testInstanceId", "createdAt");
CREATE INDEX "TestResult_status_idx" ON "TestResult" ("status");
CREATE INDEX "TestResult_source_idx" ON "TestResult" ("source");

CREATE TABLE "TestResultStep" (
  "id" BIGSERIAL PRIMARY KEY,
  "resultId" BIGINT NOT NULL REFERENCES "TestResult" ("id") ON DELETE CASCADE,
  "stepOrder" INTEGER NOT NULL,
  "status" "TestStatus" NOT NULL,
  "actualResult" TEXT NULL,
  "comment" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("resultId", "stepOrder")
);
CREATE INDEX "TestResultStep_resultId_idx" ON "TestResultStep" ("resultId");

CREATE TABLE "TestPlanEntry" (
  "id" BIGSERIAL PRIMARY KEY,
  "planId" BIGINT NOT NULL REFERENCES "TestPlan" ("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "environment" TEXT NULL,
  "suiteId" BIGINT NULL REFERENCES "TestSuite" ("id") ON DELETE SET NULL,
  "runId" BIGINT NULL REFERENCES "TestRun" ("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL
);
CREATE INDEX "TestPlanEntry_planId_idx" ON "TestPlanEntry" ("planId");
CREATE INDEX "TestPlanEntry_runId_idx" ON "TestPlanEntry" ("runId");

CREATE TABLE "Attachment" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project" ("id") ON DELETE RESTRICT,
  "entityType" TEXT NOT NULL,
  "entityId" BIGINT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NULL,
  "storagePath" TEXT NOT NULL,
  "fileSize" BIGINT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL,
  "updatedBy" BIGINT NULL
);
CREATE INDEX "Attachment_projectId_idx" ON "Attachment" ("projectId");
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment" ("entityType", "entityId");

CREATE TABLE "ApiToken" (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL REFERENCES "User" ("id") ON DELETE RESTRICT,
  "projectId" BIGINT NULL REFERENCES "Project" ("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "lastUsedAt" TIMESTAMPTZ NULL,
  "expiresAt" TIMESTAMPTZ NULL,
  "revokedAt" TIMESTAMPTZ NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken" ("userId");
CREATE INDEX "ApiToken_projectId_idx" ON "ApiToken" ("projectId");
CREATE INDEX "ApiToken_revokedAt_idx" ON "ApiToken" ("revokedAt");

CREATE TABLE "AuditLog" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NULL REFERENCES "Project" ("id") ON DELETE SET NULL,
  "actorUserId" BIGINT NULL REFERENCES "User" ("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "changes" JSONB NULL,
  "requestId" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog" ("projectId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog" ("entityType", "entityId");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog" ("actorUserId");
