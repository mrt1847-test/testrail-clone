import type { TestInstanceRow } from "../types";

type ApiInstanceLike = {
  id: string;
  caseId: string;
  titleSnapshot: string;
  status: string;
  assignedTo?: string | null;
  caseChanged?: boolean;
  changedFields?: string[];
  sectionId?: string | number | null;
  casePriority?: string | null;
  caseType?: string | null;
};

export function mapApiInstancesToRows(instances: readonly ApiInstanceLike[]): TestInstanceRow[] {
  return instances.map((instance) => ({
    id: String(instance.id),
    caseId: String(instance.caseId),
    caseCode: `C${instance.caseId}`,
    title: instance.titleSnapshot,
    status: instance.status,
    assignedTo: instance.assignedTo ? String(instance.assignedTo) : null,
    caseChanged: instance.caseChanged,
    changedFields: instance.changedFields,
    sectionId: instance.sectionId != null ? String(instance.sectionId) : null,
    casePriority: instance.casePriority ?? null,
    caseType: instance.caseType ?? null
  }));
}

export function flattenGroupedInstances(groups: ReadonlyArray<{ instances: readonly ApiInstanceLike[] }>): TestInstanceRow[] {
  const out: TestInstanceRow[] = [];
  for (const group of groups) {
    out.push(...mapApiInstancesToRows(group.instances));
  }
  return out;
}

export function mergeInstanceLookup(
  current: ReadonlyMap<string, TestInstanceRow>,
  rows: readonly TestInstanceRow[]
): Map<string, TestInstanceRow> {
  const next = new Map(current);
  for (const row of rows) next.set(row.id, row);
  return next;
}
