ALTER TABLE "TestCase" ADD COLUMN "aiInput" TEXT;
ALTER TABLE "TestCase" ADD COLUMN "aiExpectedOutput" TEXT;

ALTER TABLE "TestResult" ADD COLUMN "aiActualOutput" TEXT;
ALTER TABLE "TestResult" ADD COLUMN "aiQualityRating" INTEGER;
ALTER TABLE "TestResult" ADD COLUMN "aiLatencyMs" INTEGER;
ALTER TABLE "TestResult" ADD COLUMN "aiTraces" TEXT;
