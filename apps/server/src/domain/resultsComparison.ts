export type ResultsComparisonCaseRow = {
  caseId: string;
  title: string;
  statusA: string | null;
  statusB: string | null;
  testIdA: string | null;
  testIdB: string | null;
  changed: boolean;
  onlyInRunA: boolean;
  onlyInRunB: boolean;
};

export type ResultsComparisonReport = {
  runA: { runId: string; name: string };
  runB: { runId: string; name: string };
  summary: {
    comparedCaseCount: number;
    sharedCaseCount: number;
    changedCount: number;
    unchangedCount: number;
    onlyInRunACount: number;
    onlyInRunBCount: number;
  };
  items: ResultsComparisonCaseRow[];
};

type CaseRunStatus = {
  caseId: string;
  title: string;
  status: string;
  testId: string;
};

export function buildResultsComparisonReport(
  runA: { runId: string; name: string },
  runB: { runId: string; name: string },
  casesInRunA: CaseRunStatus[],
  casesInRunB: CaseRunStatus[]
): ResultsComparisonReport {
  const mapA = new Map(casesInRunA.map((row) => [row.caseId, row]));
  const mapB = new Map(casesInRunB.map((row) => [row.caseId, row]));
  const caseIds = [...new Set([...mapA.keys(), ...mapB.keys()])].sort((a, b) => a.localeCompare(b));

  let changedCount = 0;
  let unchangedCount = 0;
  let onlyInRunACount = 0;
  let onlyInRunBCount = 0;
  let sharedCaseCount = 0;

  const items: ResultsComparisonCaseRow[] = caseIds.map((caseId) => {
    const rowA = mapA.get(caseId);
    const rowB = mapB.get(caseId);
    const onlyInRunA = Boolean(rowA && !rowB);
    const onlyInRunB = Boolean(rowB && !rowA);
    const shared = Boolean(rowA && rowB);
    if (shared) sharedCaseCount += 1;
    if (onlyInRunA) onlyInRunACount += 1;
    if (onlyInRunB) onlyInRunBCount += 1;

    const statusA = rowA?.status ?? null;
    const statusB = rowB?.status ?? null;
    const changed = shared && statusA !== statusB;
    if (changed) changedCount += 1;
    if (shared && !changed) unchangedCount += 1;

    return {
      caseId,
      title: rowA?.title ?? rowB?.title ?? `Case ${caseId}`,
      statusA,
      statusB,
      testIdA: rowA?.testId ?? null,
      testIdB: rowB?.testId ?? null,
      changed,
      onlyInRunA,
      onlyInRunB
    };
  });

  return {
    runA,
    runB,
    summary: {
      comparedCaseCount: items.length,
      sharedCaseCount,
      changedCount,
      unchangedCount,
      onlyInRunACount,
      onlyInRunBCount
    },
    items
  };
}
