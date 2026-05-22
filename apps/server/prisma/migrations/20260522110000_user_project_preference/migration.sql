CREATE TABLE "UserProjectPreference" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "landingPage" TEXT NOT NULL DEFAULT 'overview',
    "defaultSuiteId" BIGINT,
    "defaultSavedViewId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProjectPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProjectPreference_userId_projectId_key" ON "UserProjectPreference"("userId", "projectId");
CREATE INDEX "UserProjectPreference_projectId_idx" ON "UserProjectPreference"("projectId");

ALTER TABLE "UserProjectPreference" ADD CONSTRAINT "UserProjectPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProjectPreference" ADD CONSTRAINT "UserProjectPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
