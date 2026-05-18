import {
  buildTestCaseChangeInfo,
  type LiveCaseFields
} from "../../domain/testCaseChangeIndicator.js";
import type { TestStatus } from "../../domain/status.js";
import type { TestInstance } from "./runs.types.js";

export type InstanceDbRow = {
  id: bigint;
  runId: bigint;
  caseId: bigint;
  status: string;
  assignedTo: bigint | null;
  titleSnapshot: string;
  prioritySnapshot: string | null;
  typeSnapshot: string | null;
  estimateSnapshot: string | null;
  automationKeySnapshot: string | null;
  externalIdSnapshot: string | null;
  caseLockVersionAtRun?: number | null;
};

export function mapInstanceDbRow(r: InstanceDbRow, mapStatus: (status: string) => TestStatus): TestInstance {
  return {
    id: r.id,
    runId: r.runId,
    caseId: r.caseId,
    status: mapStatus(r.status),
    assignedTo: r.assignedTo ?? null,
    titleSnapshot: r.titleSnapshot,
    prioritySnapshot: r.prioritySnapshot,
    typeSnapshot: r.typeSnapshot,
    estimateSnapshot: r.estimateSnapshot,
    automationKeySnapshot: r.automationKeySnapshot,
    externalIdSnapshot: r.externalIdSnapshot,
    caseLockVersionAtRun: r.caseLockVersionAtRun ?? null
  };
}

export function enrichTestInstancesWithCaseChange(
  instances: TestInstance[],
  casesById: Map<bigint, LiveCaseFields>,
  runCreatedAt?: Date | null
): TestInstance[] {
  return instances.map((inst) => {
    const testCase = casesById.get(inst.caseId);
    if (!testCase) return inst;
    const info = buildTestCaseChangeInfo({
      instance: {
        titleSnapshot: inst.titleSnapshot,
        prioritySnapshot: inst.prioritySnapshot,
        typeSnapshot: inst.typeSnapshot,
        automationKeySnapshot: inst.automationKeySnapshot,
        externalIdSnapshot: inst.externalIdSnapshot,
        caseLockVersionAtRun: inst.caseLockVersionAtRun
      },
      testCase,
      runCreatedAt
    });
    return {
      ...inst,
      caseChanged: info.caseChanged,
      caseLockVersionAtRun: info.caseLockVersionAtRun,
      currentCaseLockVersion: info.currentCaseLockVersion,
      changedFields: info.changedFields,
      sectionId: testCase.sectionId,
      casePriority: testCase.priority,
      caseType: testCase.caseType
    };
  });
}

export function testCaseToLiveFields(row: {
  lockVersion: number;
  title: string;
  sectionId: bigint;
  priority: string | null;
  caseType: string | null;
  automationKey: string | null;
  externalId: string | null;
  updatedAt: Date;
}): LiveCaseFields {
  return {
    lockVersion: row.lockVersion,
    title: row.title,
    sectionId: row.sectionId,
    priority: row.priority,
    caseType: row.caseType,
    automationKey: row.automationKey,
    externalId: row.externalId,
    updatedAt: row.updatedAt
  };
}
