export type TestCaseSnapshotFields = {
  titleSnapshot: string;
  prioritySnapshot: string | null;
  typeSnapshot: string | null;
  automationKeySnapshot: string | null;
  externalIdSnapshot: string | null;
  caseLockVersionAtRun?: number | null;
};

export type LiveCaseFields = {
  lockVersion: number;
  title: string;
  sectionId: bigint;
  priority: string | null;
  caseType: string | null;
  automationKey: string | null;
  externalId: string | null;
  updatedAt: Date;
};

export type TestCaseChangeInfo = {
  caseChanged: boolean;
  caseLockVersionAtRun: number | null;
  currentCaseLockVersion: number;
  changedFields: string[];
};

function norm(value: string | null | undefined) {
  return value ?? null;
}

export function listSnapshotFieldChanges(snapshot: TestCaseSnapshotFields, current: LiveCaseFields): string[] {
  const changed: string[] = [];
  if (snapshot.titleSnapshot !== current.title) changed.push("title");
  if (norm(snapshot.prioritySnapshot) !== norm(current.priority)) changed.push("priority");
  if (norm(snapshot.typeSnapshot) !== norm(current.caseType)) changed.push("type");
  if (norm(snapshot.automationKeySnapshot) !== norm(current.automationKey)) changed.push("automationKey");
  if (norm(snapshot.externalIdSnapshot) !== norm(current.externalId)) changed.push("externalId");
  return changed;
}

export function buildTestCaseChangeInfo(input: {
  instance: TestCaseSnapshotFields;
  testCase: LiveCaseFields;
  runCreatedAt?: Date | null;
}): TestCaseChangeInfo {
  const changedFields = listSnapshotFieldChanges(input.instance, input.testCase);
  const atRun = input.instance.caseLockVersionAtRun ?? null;
  const current = input.testCase.lockVersion;

  let caseChanged = false;
  if (atRun != null && current > atRun) {
    caseChanged = true;
  } else if (input.runCreatedAt && input.testCase.updatedAt <= input.runCreatedAt) {
    caseChanged = false;
  } else if (changedFields.length > 0) {
    caseChanged = true;
  }

  return {
    caseChanged,
    caseLockVersionAtRun: atRun,
    currentCaseLockVersion: current,
    changedFields: caseChanged ? changedFields : []
  };
}
