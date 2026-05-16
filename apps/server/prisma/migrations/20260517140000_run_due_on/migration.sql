ALTER TABLE "TestRun" ADD COLUMN "dueOn" TIMESTAMPTZ NULL;

CREATE INDEX "TestRun_dueOn_idx" ON "TestRun" ("dueOn");
