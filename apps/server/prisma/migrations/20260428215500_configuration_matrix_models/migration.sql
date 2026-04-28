CREATE TABLE "ConfigurationGroup" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  UNIQUE ("projectId", "name")
);

CREATE INDEX "ConfigurationGroup_projectId_displayOrder_idx" ON "ConfigurationGroup"("projectId", "displayOrder");

CREATE TABLE "Configuration" (
  "id" BIGSERIAL PRIMARY KEY,
  "groupId" BIGINT NOT NULL REFERENCES "ConfigurationGroup"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  UNIQUE ("groupId", "name")
);

CREATE INDEX "Configuration_groupId_displayOrder_idx" ON "Configuration"("groupId", "displayOrder");

CREATE TABLE "TestPlanEntryConfiguration" (
  "id" BIGSERIAL PRIMARY KEY,
  "planEntryId" BIGINT NOT NULL REFERENCES "TestPlanEntry"("id") ON DELETE CASCADE,
  "configurationId" BIGINT NOT NULL REFERENCES "Configuration"("id") ON DELETE CASCADE,
  UNIQUE ("planEntryId", "configurationId")
);
