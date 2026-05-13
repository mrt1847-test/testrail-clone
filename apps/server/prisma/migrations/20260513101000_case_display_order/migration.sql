ALTER TABLE public."TestCase" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "sectionId" ORDER BY "id" ASC) - 1 AS "nextOrder"
  FROM public."TestCase"
)
UPDATE public."TestCase"
SET "displayOrder" = ranked."nextOrder"
FROM ranked
WHERE public."TestCase"."id" = ranked."id";

CREATE INDEX "TestCase_sectionId_displayOrder_id_idx" ON public."TestCase"("sectionId", "displayOrder", "id");
