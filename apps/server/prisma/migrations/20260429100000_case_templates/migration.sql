CREATE TABLE "CaseTemplate" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT,
    "updatedBy" BIGINT,

    CONSTRAINT "CaseTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseTemplate_projectId_name_key" ON "CaseTemplate"("projectId", "name");
CREATE INDEX "CaseTemplate_projectId_isActive_displayOrder_idx" ON "CaseTemplate"("projectId", "isActive", "displayOrder");
CREATE INDEX "CaseTemplate_projectId_deletedAt_idx" ON "CaseTemplate"("projectId", "deletedAt");

ALTER TABLE "CaseTemplate" ADD CONSTRAINT "CaseTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
