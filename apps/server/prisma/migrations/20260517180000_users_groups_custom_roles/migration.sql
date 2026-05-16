ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "globalRole" TEXT NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS "UserGroup" (
  "id" BIGSERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  "createdBy" BIGINT NULL REFERENCES "User" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "UserGroup_deletedAt_idx" ON "UserGroup" ("deletedAt");

CREATE TABLE IF NOT EXISTS "UserGroupMember" (
  "id" BIGSERIAL PRIMARY KEY,
  "groupId" BIGINT NOT NULL REFERENCES "UserGroup" ("id") ON DELETE CASCADE,
  "userId" BIGINT NOT NULL REFERENCES "User" ("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("groupId", "userId")
);
CREATE INDEX IF NOT EXISTS "UserGroupMember_userId_idx" ON "UserGroupMember" ("userId");

CREATE TABLE IF NOT EXISTS "CustomRole" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project" ("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "systemName" TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ NULL,
  UNIQUE ("projectId", "systemName")
);
CREATE INDEX IF NOT EXISTS "CustomRole_projectId_idx" ON "CustomRole" ("projectId");

ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "customRoleId" BIGINT NULL REFERENCES "CustomRole" ("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "ProjectMember_customRoleId_idx" ON "ProjectMember" ("customRoleId");
