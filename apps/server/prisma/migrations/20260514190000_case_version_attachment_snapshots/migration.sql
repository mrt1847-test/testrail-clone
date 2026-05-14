ALTER TABLE "TestCaseVersion"
ADD COLUMN "attachmentSnapshots" JSONB NOT NULL DEFAULT '[]';
