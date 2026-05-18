CREATE TABLE "SharedStep" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" BIGINT,
    "updatedBy" BIGINT,

    CONSTRAINT "SharedStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharedStepEntry" (
    "id" BIGSERIAL NOT NULL,
    "sharedStepId" BIGINT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "expectedResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SharedStepEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TestCaseStep" ADD COLUMN "sharedStepId" BIGINT;
ALTER TABLE "TestCaseStep" ADD COLUMN "sharedStepEntryId" BIGINT;

CREATE INDEX "SharedStep_projectId_idx" ON "SharedStep"("projectId");
CREATE INDEX "SharedStep_projectId_deletedAt_idx" ON "SharedStep"("projectId", "deletedAt");
CREATE INDEX "SharedStepEntry_sharedStepId_idx" ON "SharedStepEntry"("sharedStepId");
CREATE UNIQUE INDEX "SharedStepEntry_sharedStepId_stepOrder_key" ON "SharedStepEntry"("sharedStepId", "stepOrder");
CREATE INDEX "TestCaseStep_sharedStepId_idx" ON "TestCaseStep"("sharedStepId");
CREATE INDEX "TestCaseStep_sharedStepEntryId_idx" ON "TestCaseStep"("sharedStepEntryId");

ALTER TABLE "SharedStep" ADD CONSTRAINT "SharedStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedStepEntry" ADD CONSTRAINT "SharedStepEntry_sharedStepId_fkey" FOREIGN KEY ("sharedStepId") REFERENCES "SharedStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestCaseStep" ADD CONSTRAINT "TestCaseStep_sharedStepId_fkey" FOREIGN KEY ("sharedStepId") REFERENCES "SharedStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestCaseStep" ADD CONSTRAINT "TestCaseStep_sharedStepEntryId_fkey" FOREIGN KEY ("sharedStepEntryId") REFERENCES "SharedStepEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
