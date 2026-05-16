ALTER TABLE "CustomStatus" ADD COLUMN "isFinal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomStatus" ADD COLUMN "isUntested" BOOLEAN NOT NULL DEFAULT false;

UPDATE "CustomStatus"
SET
  "isUntested" = ("canonicalStatus" = 'untested'),
  "isFinal" = ("canonicalStatus" IN ('passed', 'failed', 'blocked'));
