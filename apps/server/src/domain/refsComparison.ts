export type RefRunStatusInput = {
  refKey: string;
  caseId: string;
  caseTitle: string;
  statusA: string | null;
  statusB: string | null;
  testIdA: string | null;
  testIdB: string | null;
};

export type RefsComparisonRow = {
  refKey: string;
  linkedCaseCount: number;
  statusA: string | null;
  statusB: string | null;
  changed: boolean;
  onlyInRunA: boolean;
  onlyInRunB: boolean;
  caseIds: string[];
};

export type RefsComparisonReport = {
  runA: { runId: string; name: string };
  runB: { runId: string; name: string };
  summary: {
    comparedRefCount: number;
    sharedRefCount: number;
    changedCount: number;
    unchangedCount: number;
    onlyInRunACount: number;
    onlyInRunBCount: number;
  };
  items: RefsComparisonRow[];
};

const STATUS_PRIORITY = ["failed", "blocked", "retest", "untested", "passed"] as const;

function aggregateStatus(statuses: string[]): string | null {
  if (statuses.length === 0) return null;
  for (const status of STATUS_PRIORITY) {
    if (statuses.includes(status)) return status;
  }
  return statuses[0] ?? null;
}

export function buildRefsComparisonReport(
  runA: { runId: string; name: string },
  runB: { runId: string; name: string },
  inputs: RefRunStatusInput[]
): RefsComparisonReport {
  const byRef = new Map<string, RefRunStatusInput[]>();
  for (const row of inputs) {
    const bucket = byRef.get(row.refKey) ?? [];
    bucket.push(row);
    byRef.set(row.refKey, bucket);
  }

  let changedCount = 0;
  let unchangedCount = 0;
  let onlyInRunACount = 0;
  let onlyInRunBCount = 0;
  let sharedRefCount = 0;

  const items: RefsComparisonRow[] = [...byRef.entries()]
    .map(([refKey, rows]) => {
      const caseIds = [...new Set(rows.map((row) => row.caseId))].sort((a, b) => a.localeCompare(b));
      const statusesA = rows.map((row) => row.statusA).filter((status): status is string => Boolean(status));
      const statusesB = rows.map((row) => row.statusB).filter((status): status is string => Boolean(status));
      const statusA = aggregateStatus(statusesA);
      const statusB = aggregateStatus(statusesB);
      const onlyInRunA = statusA != null && statusB == null;
      const onlyInRunB = statusB != null && statusA == null;
      const shared = statusA != null && statusB != null;
      if (shared) sharedRefCount += 1;
      if (onlyInRunA) onlyInRunACount += 1;
      if (onlyInRunB) onlyInRunBCount += 1;
      const changed = shared && statusA !== statusB;
      if (changed) changedCount += 1;
      if (shared && !changed) unchangedCount += 1;

      return {
        refKey,
        linkedCaseCount: caseIds.length,
        statusA,
        statusB,
        changed,
        onlyInRunA,
        onlyInRunB,
        caseIds
      };
    })
    .sort((a, b) => a.refKey.localeCompare(b.refKey));

  return {
    runA,
    runB,
    summary: {
      comparedRefCount: items.length,
      sharedRefCount,
      changedCount,
      unchangedCount,
      onlyInRunACount,
      onlyInRunBCount
    },
    items
  };
}
