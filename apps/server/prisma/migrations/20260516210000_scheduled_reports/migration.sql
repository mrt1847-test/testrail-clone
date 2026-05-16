CREATE TABLE "ScheduledReport" (
  "id" BIGSERIAL NOT NULL,
  "projectId" BIGINT NOT NULL,
  "name" TEXT NOT NULL,
  "savedReportId" BIGINT,
  "reportType" TEXT NOT NULL,
  "filters" JSONB,
  "intervalMinutes" INTEGER NOT NULL,
  "recipientEmails" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "lastExportJobId" BIGINT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdBy" BIGINT,
  CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScheduledReport"
  ADD CONSTRAINT "ScheduledReport_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduledReport"
  ADD CONSTRAINT "ScheduledReport_savedReportId_fkey"
  FOREIGN KEY ("savedReportId") REFERENCES "SavedReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ScheduledReport_projectId_deletedAt_enabled_nextRunAt_idx"
  ON "ScheduledReport"("projectId", "deletedAt", "enabled", "nextRunAt");

CREATE INDEX "ScheduledReport_savedReportId_idx" ON "ScheduledReport"("savedReportId");
