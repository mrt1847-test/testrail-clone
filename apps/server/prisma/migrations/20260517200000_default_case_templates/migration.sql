ALTER TABLE "CaseTemplate" ADD COLUMN "systemKey" TEXT;

CREATE UNIQUE INDEX "CaseTemplate_projectId_systemKey_key" ON "CaseTemplate"("projectId", "systemKey");

ALTER TABLE "TestCase" ADD COLUMN "caseTemplateId" BIGINT;

CREATE INDEX "TestCase_caseTemplateId_idx" ON "TestCase"("caseTemplateId");

ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_caseTemplateId_fkey" FOREIGN KEY ("caseTemplateId") REFERENCES "CaseTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
