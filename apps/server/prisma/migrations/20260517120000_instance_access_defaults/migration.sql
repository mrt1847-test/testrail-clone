CREATE TABLE "InstanceAccessDefaults" (
  "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "defaultProjectMemberRole" TEXT NOT NULL DEFAULT 'viewer',
  "newProjectAccessMode" TEXT NOT NULL DEFAULT 'creator_only',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedBy" BIGINT NULL REFERENCES "User" ("id") ON DELETE SET NULL,
  CONSTRAINT "InstanceAccessDefaults_singleton" CHECK ("id" = 1),
  CONSTRAINT "InstanceAccessDefaults_role_check" CHECK (
    "defaultProjectMemberRole" IN ('manager', 'tester', 'viewer')
  ),
  CONSTRAINT "InstanceAccessDefaults_access_mode_check" CHECK (
    "newProjectAccessMode" IN ('creator_only', 'all_active_users')
  )
);

INSERT INTO "InstanceAccessDefaults" ("id", "defaultProjectMemberRole", "newProjectAccessMode")
VALUES (1, 'viewer', 'creator_only');
