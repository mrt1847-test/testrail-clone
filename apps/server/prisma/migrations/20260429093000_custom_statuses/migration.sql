CREATE TABLE "CustomStatus" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "systemName" TEXT NOT NULL,
    "canonicalStatus" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT,
    "updatedBy" BIGINT,

    CONSTRAINT "CustomStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomStatus_projectId_systemName_key" ON "CustomStatus"("projectId", "systemName");
CREATE INDEX "CustomStatus_projectId_isActive_displayOrder_idx" ON "CustomStatus"("projectId", "isActive", "displayOrder");
CREATE INDEX "CustomStatus_projectId_deletedAt_idx" ON "CustomStatus"("projectId", "deletedAt");

ALTER TABLE "CustomStatus" ADD CONSTRAINT "CustomStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
