function isAtRiskStatus(status: string) {
  return status === "failed" || status === "blocked" || status === "retest";
}

export type DefectSummaryScope = {
  type: "project" | "milestone" | "plan" | "run";
  id: string | null;
  label: string;
};

export type DefectSummaryTestInput = {
  runId: string;
  runName: string;
  testId: string;
  caseId: string;
  title: string;
  latestResult: {
    resultId: string;
    status: string;
    defectKeys: string[];
    createdAt: string;
  } | null;
};

export type DefectSummaryDashboard = {
  runCount: number;
  testCount: number;
  atRiskResultCount: number;
  linkedDefectCount: number;
  unlinkedAtRiskCount: number;
};

export type DefectSummaryDefectRow = {
  defectKey: string;
  linkedResultCount: number;
  failedCount: number;
  blockedCount: number;
  retestCount: number;
};

export type DefectSummaryUnlinkedRow = {
  runId: string;
  runName: string;
  testId: string;
  caseId: string;
  title: string;
  status: string;
  resultId: string;
  createdAt: string;
};

export type DefectSummaryRunRow = {
  runId: string;
  runName: string;
  testCount: number;
  atRiskResultCount: number;
  linkedDefectCount: number;
  unlinkedAtRiskCount: number;
};

export type DefectSummaryReport = {
  scope: DefectSummaryScope;
  dashboard: DefectSummaryDashboard;
  defects: DefectSummaryDefectRow[];
  unlinkedAtRisk: DefectSummaryUnlinkedRow[];
  runs: DefectSummaryRunRow[];
};

function normalizeDefectKeys(keys: string[]) {
  return keys.map((key) => key.trim()).filter((key) => key.length > 0);
}

export function buildDefectSummaryReport(
  tests: DefectSummaryTestInput[],
  scope: DefectSummaryScope
): DefectSummaryReport {
  const defectMap = new Map<string, DefectSummaryDefectRow>();
  const unlinkedAtRisk: DefectSummaryUnlinkedRow[] = [];
  const runMap = new Map<string, DefectSummaryRunRow>();
  let atRiskResultCount = 0;

  for (const test of tests) {
    const runBucket =
      runMap.get(test.runId) ??
      ({
        runId: test.runId,
        runName: test.runName,
        testCount: 0,
        atRiskResultCount: 0,
        linkedDefectCount: 0,
        unlinkedAtRiskCount: 0
      } satisfies DefectSummaryRunRow);
    runBucket.testCount += 1;

    const latest = test.latestResult;
    if (!latest || !isAtRiskStatus(latest.status)) {
      runMap.set(test.runId, runBucket);
      continue;
    }

    atRiskResultCount += 1;
    runBucket.atRiskResultCount += 1;
    const keys = normalizeDefectKeys(latest.defectKeys);

    if (keys.length === 0) {
      runBucket.unlinkedAtRiskCount += 1;
      unlinkedAtRisk.push({
        runId: test.runId,
        runName: test.runName,
        testId: test.testId,
        caseId: test.caseId,
        title: test.title,
        status: latest.status,
        resultId: latest.resultId,
        createdAt: latest.createdAt
      });
    } else {
      for (const defectKey of keys) {
        const row =
          defectMap.get(defectKey) ??
          ({
            defectKey,
            linkedResultCount: 0,
            failedCount: 0,
            blockedCount: 0,
            retestCount: 0
          } satisfies DefectSummaryDefectRow);
        row.linkedResultCount += 1;
        if (latest.status === "failed") row.failedCount += 1;
        if (latest.status === "blocked") row.blockedCount += 1;
        if (latest.status === "retest") row.retestCount += 1;
        defectMap.set(defectKey, row);
      }
    }

    runMap.set(test.runId, runBucket);
  }

  const linkedDefectCount = defectMap.size;
  const unlinkedAtRiskCount = unlinkedAtRisk.length;

  for (const run of runMap.values()) {
    const runTests = tests.filter((test) => test.runId === run.runId);
    const keys = new Set<string>();
    for (const test of runTests) {
      const latest = test.latestResult;
      if (!latest || !isAtRiskStatus(latest.status)) continue;
      for (const key of normalizeDefectKeys(latest.defectKeys)) keys.add(key);
    }
    run.linkedDefectCount = keys.size;
  }

  const runCount = new Set(tests.map((test) => test.runId)).size;

  return {
    scope,
    dashboard: {
      runCount,
      testCount: tests.length,
      atRiskResultCount,
      linkedDefectCount,
      unlinkedAtRiskCount
    },
    defects: [...defectMap.values()].sort(
      (a, b) => b.linkedResultCount - a.linkedResultCount || a.defectKey.localeCompare(b.defectKey)
    ),
    unlinkedAtRisk: unlinkedAtRisk.sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt) || a.runName.localeCompare(b.runName)
    ),
    runs: [...runMap.values()].sort((a, b) => a.runName.localeCompare(b.runName))
  };
}
