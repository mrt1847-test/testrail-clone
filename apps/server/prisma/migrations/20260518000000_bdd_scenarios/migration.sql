-- CreateTable
CREATE TABLE "TestCaseScenario" (
    "id" BIGSERIAL NOT NULL,
    "caseId" BIGINT NOT NULL,
    "scenarioOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TestCaseScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResultScenario" (
    "id" BIGSERIAL NOT NULL,
    "resultId" BIGINT NOT NULL,
    "caseScenarioId" BIGINT NOT NULL,
    "status" "TestStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResultScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCaseScenario_caseId_idx" ON "TestCaseScenario"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseScenario_caseId_scenarioOrder_key" ON "TestCaseScenario"("caseId", "scenarioOrder");

-- CreateIndex
CREATE INDEX "TestResultScenario_resultId_idx" ON "TestResultScenario"("resultId");

-- CreateIndex
CREATE INDEX "TestResultScenario_caseScenarioId_idx" ON "TestResultScenario"("caseScenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "TestResultScenario_resultId_caseScenarioId_key" ON "TestResultScenario"("resultId", "caseScenarioId");

-- AddForeignKey
ALTER TABLE "TestCaseScenario" ADD CONSTRAINT "TestCaseScenario_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResultScenario" ADD CONSTRAINT "TestResultScenario_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "TestResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResultScenario" ADD CONSTRAINT "TestResultScenario_caseScenarioId_fkey" FOREIGN KEY ("caseScenarioId") REFERENCES "TestCaseScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
