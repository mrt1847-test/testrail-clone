-- ApiToken.scopes exists in Prisma schema; ensure DB column for environments created from init migration only.
ALTER TABLE "ApiToken" ADD COLUMN IF NOT EXISTS "scopes" TEXT[] NOT NULL DEFAULT ARRAY['automation:read', 'automation:write']::TEXT[];
