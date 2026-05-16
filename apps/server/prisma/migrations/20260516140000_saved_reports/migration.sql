-- CreateTable
CREATE TABLE "SavedReport" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "filters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT,

    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedReport_projectId_deletedAt_updatedAt_idx" ON "SavedReport"("projectId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "SavedReport_projectId_reportType_idx" ON "SavedReport"("projectId", "reportType");

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
