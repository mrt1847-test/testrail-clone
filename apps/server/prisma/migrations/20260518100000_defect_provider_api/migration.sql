-- AlterTable
ALTER TABLE "DefectIntegrationSetting" ADD COLUMN "createMode" TEXT NOT NULL DEFAULT 'url_template';
ALTER TABLE "DefectIntegrationSetting" ADD COLUMN "apiBaseUrl" TEXT;
ALTER TABLE "DefectIntegrationSetting" ADD COLUMN "apiToken" TEXT;

-- AlterTable
ALTER TABLE "ResultDefectLink" ADD COLUMN "remoteStatus" TEXT;
ALTER TABLE "ResultDefectLink" ADD COLUMN "remoteStatusLabel" TEXT;
ALTER TABLE "ResultDefectLink" ADD COLUMN "remoteStatusSyncedAt" TIMESTAMP(3);
ALTER TABLE "ResultDefectLink" ADD COLUMN "providerIssueId" TEXT;
ALTER TABLE "ResultDefectLink" ADD COLUMN "createMode" TEXT;
