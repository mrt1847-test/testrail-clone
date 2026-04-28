-- CreateTable
CREATE TABLE "DefectIntegrationSetting" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'custom',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "issueUrlTemplate" TEXT,
    "defaultProjectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DefectIntegrationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DefectIntegrationSetting_projectId_key" ON "DefectIntegrationSetting"("projectId");

-- CreateIndex
CREATE INDEX "DefectIntegrationSetting_projectId_idx" ON "DefectIntegrationSetting"("projectId");

-- AddForeignKey
ALTER TABLE "DefectIntegrationSetting" ADD CONSTRAINT "DefectIntegrationSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
