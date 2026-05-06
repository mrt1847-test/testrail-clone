-- AlterTable
ALTER TABLE "TestRun" ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "TestResult" ADD COLUMN "metadata" JSONB;
