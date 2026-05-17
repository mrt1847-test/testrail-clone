CREATE TABLE "ExecutionComment" (
  "id" BIGSERIAL PRIMARY KEY,
  "projectId" BIGINT NOT NULL REFERENCES "Project" ("id") ON DELETE CASCADE,
  "entityType" TEXT NOT NULL,
  "entityId" BIGINT NOT NULL,
  "parentId" BIGINT REFERENCES "ExecutionComment" ("id") ON DELETE SET NULL,
  "content" TEXT NOT NULL,
  "createdBy" BIGINT REFERENCES "User" ("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);

CREATE INDEX "ExecutionComment_project_entity_created_idx"
  ON "ExecutionComment" ("projectId", "entityType", "entityId", "createdAt");

CREATE INDEX "ExecutionComment_parentId_idx" ON "ExecutionComment" ("parentId");
