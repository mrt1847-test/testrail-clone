ALTER TABLE "Project" ADD COLUMN "projectType" TEXT NOT NULL DEFAULT 'single_repo';

ALTER TABLE "TestSuite" ADD COLUMN "isMaster" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TestSuite" ADD COLUMN "isBaseline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TestSuite" ADD COLUMN "parentSuiteId" BIGINT;

CREATE INDEX "TestSuite_projectId_isMaster_idx" ON "TestSuite"("projectId", "isMaster");
CREATE INDEX "TestSuite_projectId_isBaseline_idx" ON "TestSuite"("projectId", "isBaseline");
CREATE INDEX "TestSuite_parentSuiteId_idx" ON "TestSuite"("parentSuiteId");

ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_parentSuiteId_fkey" FOREIGN KEY ("parentSuiteId") REFERENCES "TestSuite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
