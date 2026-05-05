import type { TestStatus } from "../../domain/status.js";

export type TestRun = {
  id: bigint;
  projectId: bigint;
  suiteId: bigint;
  milestoneId: bigint | null;
  name: string;
  includeAll: boolean;
  status: "open" | "closed";
  assignedTo: bigint | null;
  environment: string | null;
};

export type TestCase = {
  id: bigint;
  projectId: bigint;
  suiteId: bigint;
  sectionId?: bigint;
  title: string;
  priority: string | null;
  caseType: string | null;
  estimate: string | null;
  automationKey: string | null;
  externalId: string | null;
};

export type TestInstance = {
  id: bigint;
  runId: bigint;
  caseId: bigint;
  status: TestStatus;
  assignedTo: bigint | null;
  titleSnapshot: string;
  prioritySnapshot: string | null;
  typeSnapshot: string | null;
  estimateSnapshot: string | null;
  automationKeySnapshot: string | null;
  externalIdSnapshot: string | null;
};

export type CreateRunWithInstancesInput = {
  projectId: bigint;
  suiteId: bigint;
  milestoneId?: bigint | null;
  name: string;
  includeAll: boolean;
  caseIds?: bigint[];
  excludedCaseIds?: bigint[];
  includedSectionIds?: bigint[];
  excludedSectionIds?: bigint[];
  environment?: string | null;
};
