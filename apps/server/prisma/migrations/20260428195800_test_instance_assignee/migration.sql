ALTER TABLE "TestInstance"
  ADD COLUMN "assignedTo" BIGINT NULL;

ALTER TABLE "TestInstance"
  ADD CONSTRAINT "TestInstance_assignedTo_fkey"
  FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL;

CREATE INDEX "TestInstance_assignedTo_idx" ON "TestInstance"("assignedTo");
