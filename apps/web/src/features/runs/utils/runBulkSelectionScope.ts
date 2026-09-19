import type { BulkRunResultItem } from "../api/runApi";
import type { ResultStatus } from "../components/resultEntryTypes";
import type { RunInstanceGroupBy, TestInstanceRow } from "../types";
import type { RunInstanceListFilters } from "./runInstanceListParams";

export type BulkResultFailureRow = {
  caseId: string;
  caseCode: string;
  title: string;
  message: string;
};

export type BulkSubmitTarget = {
  testId: string;
  caseId: string;
  caseCode: string;
  title: string;
};

export type BulkSubmitSnapshot = {
  testIds: string[];
  targets: BulkSubmitTarget[];
  status: ResultStatus;
  comment: string;
};

export type ResolveBulkTargetsResult =
  | { ok: true; targets: BulkSubmitTarget[] }
  | { ok: false; missingIds: string[]; message: string };

export type MatchingInstancesFetchPlan = {
  kind: "grouped" | "paged";
  groupBy: RunInstanceGroupBy;
  sectionId: string | null;
  filters: Partial<RunInstanceListFilters>;
};

function rowToTarget(row: TestInstanceRow): BulkSubmitTarget {
  return {
    testId: row.id,
    caseId: row.caseId,
    caseCode: row.caseCode,
    title: row.title
  };
}

/** Current bulk mapping: lookup misses are dropped. Kept to prove the UI-032 defect. */
export function dropUnknownBulkTargets(
  selectedTestIds: readonly string[],
  lookup: ReadonlyMap<string, TestInstanceRow>
): BulkSubmitTarget[] {
  return selectedTestIds
    .map((testId) => lookup.get(testId))
    .filter((row): row is TestInstanceRow => Boolean(row))
    .map(rowToTarget);
}

export function resolveBulkSubmitTargets(
  selectedTestIds: readonly string[],
  lookup: ReadonlyMap<string, TestInstanceRow>
): ResolveBulkTargetsResult {
  if (selectedTestIds.length === 0) {
    return { ok: false, missingIds: [], message: "Select at least one test." };
  }
  const targets: BulkSubmitTarget[] = [];
  const missingIds: string[] = [];
  for (const testId of selectedTestIds) {
    const row = lookup.get(testId);
    if (!row) missingIds.push(testId);
    else targets.push(rowToTarget(row));
  }
  if (missingIds.length > 0) {
    const count = missingIds.length;
    return {
      ok: false,
      missingIds,
      message:
        count === 1
          ? "1 selected test is no longer in this view. Clear selection or select the visible tests again."
          : `${count} selected tests are no longer in this view. Clear selection or select the visible tests again.`
    };
  }
  return { ok: true, targets };
}

export function captureBulkSubmitSnapshot(input: {
  selectedTestIds: readonly string[];
  lookup: ReadonlyMap<string, TestInstanceRow>;
  status: ResultStatus;
  comment: string;
}): ResolveBulkTargetsResult & { snapshot?: BulkSubmitSnapshot } {
  const resolved = resolveBulkSubmitTargets(input.selectedTestIds, input.lookup);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    targets: resolved.targets,
    snapshot: {
      testIds: [...input.selectedTestIds],
      targets: resolved.targets,
      status: input.status,
      comment: input.comment
    }
  };
}

export function visibleMatchingTotal(input: { grouped: boolean; groupedTotal: number; pagedTotal: number }): number {
  return input.grouped ? input.groupedTotal : input.pagedTotal;
}

export function buildMatchingInstancesFetchPlan(input: {
  groupBy: RunInstanceGroupBy;
  sectionId: string | null;
  filters: Partial<RunInstanceListFilters>;
}): MatchingInstancesFetchPlan {
  if (input.groupBy !== "none" || input.sectionId) {
    return {
      kind: "grouped",
      groupBy: input.groupBy === "none" ? "section_id" : input.groupBy,
      sectionId: input.sectionId,
      filters: input.filters
    };
  }
  return {
    kind: "paged",
    groupBy: "none",
    sectionId: null,
    filters: input.filters
  };
}

export function failedBulkRecovery(
  items: readonly BulkRunResultItem[],
  snapshot: BulkSubmitSnapshot
): { selectedTestIds: string[]; failures: BulkResultFailureRow[]; recovery: BulkSubmitSnapshot | null } {
  const targetByCaseId = new Map(snapshot.targets.map((target) => [target.caseId, target]));
  const failedItems = items.filter((item) => item.status === "failed");
  const failures: BulkResultFailureRow[] = failedItems.map((item) => {
    const target =
      snapshot.targets.find((row) => row.testId === item.testId || row.caseId === item.caseId) ??
      targetByCaseId.get(item.caseId);
    return {
      caseId: item.caseId,
      caseCode: target?.caseCode ?? `C${item.caseId}`,
      title: target?.title ?? "Unknown case",
      message:
        item.errorCode === "UNTESTED_NOT_ALLOWED"
          ? "Untested cannot be set after a result exists for this test."
          : (item.message ?? item.errorCode ?? "Failed to save result")
    };
  });
  const selectedTestIds = failedItems
    .map((item) => item.testId ?? targetByCaseId.get(item.caseId)?.testId)
    .filter((id): id is string => Boolean(id));
  const recoveryTargets = snapshot.targets.filter((target) => selectedTestIds.includes(target.testId));
  return {
    selectedTestIds,
    failures,
    recovery:
      recoveryTargets.length > 0
        ? {
            testIds: selectedTestIds,
            targets: recoveryTargets,
            status: snapshot.status,
            comment: snapshot.comment
          }
        : null
  };
}
