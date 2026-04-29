ALTER TABLE "TestCase" ADD COLUMN "customValues" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "TestCaseVersion" ADD COLUMN "customValuesSnapshot" JSONB NOT NULL DEFAULT '{}';
