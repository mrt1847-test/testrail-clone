import type { TestStatus } from "../../domain/status.js";
import type { CompositionMode, RunCaseFilterDefinition, RunCompositionMetadata } from "./runComposition.js";

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
  startedAt?: Date | null;
  dueOn?: Date | null;
  closedAt?: Date | null;
  planId?: bigint | null;
  createdAt?: Date | null;
  composition?: RunCompositionMetadata | null;
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
  lockVersion?: number;
  updatedAt?: Date;
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
  caseLockVersionAtRun?: number | null;
  caseChanged?: boolean;
  currentCaseLockVersion?: number | null;
  changedFields?: string[];
};

export type CreateRunWithInstancesInput = {
  projectId: bigint;
  suiteId: bigint;
  milestoneId?: bigint | null;
  startedAt?: Date | null;
  dueOn?: Date | null;
  name: string;
  includeAll: boolean;
  caseIds?: bigint[];
  excludedCaseIds?: bigint[];
  includedSectionIds?: bigint[];
  excludedSectionIds?: bigint[];
  environment?: string | null;
  assignedTo?: bigint | null;
  compositionMode?: CompositionMode;
  filterDefinition?: RunCaseFilterDefinition;
};
