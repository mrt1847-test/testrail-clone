ALTER TABLE "Milestone" ADD COLUMN "parentMilestoneId" BIGINT;

ALTER TABLE "Milestone"
  ADD CONSTRAINT "Milestone_parentMilestoneId_fkey"
  FOREIGN KEY ("parentMilestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Milestone_parentMilestoneId_idx" ON "Milestone"("parentMilestoneId");
