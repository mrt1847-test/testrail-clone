ALTER TABLE "TestPlan"
  ADD COLUMN "assignedTo" BIGINT,
  ADD COLUMN "refs" TEXT,
  ADD COLUMN "startDate" TIMESTAMPTZ,
  ADD COLUMN "dueOn" TIMESTAMPTZ;

ALTER TABLE "TestPlan"
  ADD CONSTRAINT "TestPlan_assignedTo_fkey"
  FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TestPlan_assignedTo_idx" ON "TestPlan"("assignedTo");

ALTER TABLE "TestPlanEntry"
  ADD COLUMN "assignedTo" BIGINT,
  ADD COLUMN "refs" TEXT,
  ADD COLUMN "startDate" TIMESTAMPTZ,
  ADD COLUMN "dueOn" TIMESTAMPTZ,
  ADD COLUMN "includeAll" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "includeCaseIds" JSONB,
  ADD COLUMN "excludeCaseIds" JSONB,
  ADD COLUMN "isIncluded" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "TestPlanEntry"
  ADD CONSTRAINT "TestPlanEntry_assignedTo_fkey"
  FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TestPlanEntry_assignedTo_idx" ON "TestPlanEntry"("assignedTo");
